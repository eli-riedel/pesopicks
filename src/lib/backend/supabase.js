// Multi-device backend. Reads come straight from tables; writes go through pp_* RPCs.
import { createClient } from '@supabase/supabase-js'

const USER_COLS = 'id,name,is_admin,balance,player_id,avatar,created_at'

const mapPlayer = (r) => ({ id: r.id, name: r.name, nickname: r.nickname, emoji: r.emoji, color: r.color, photo: r.photo })
const mapProp = (r) => ({
  id: r.id,
  playerId: r.player_id,
  stat: r.stat,
  category: r.category,
  line: Number(r.line),
  kind: r.kind,
  event: r.event,
  startsAt: r.starts_at,
  status: r.status,
  current: Number(r.current),
  result: r.result == null ? null : Number(r.result),
  recurring: r.recurring,
  parentId: r.parent_id,
  createdAt: r.created_at,
})
const mapUser = (r) => ({
  id: r.id,
  name: r.name,
  isAdmin: r.is_admin,
  balance: Number(r.balance),
  playerId: r.player_id,
  avatar: r.avatar,
  createdAt: r.created_at,
})
const mapLineup = (r) => ({
  id: r.id,
  userId: r.user_id,
  mode: r.mode,
  amount: Number(r.amount),
  picks: r.picks,
  multiplier: Number(r.multiplier),
  status: r.status,
  payout: Number(r.payout),
  createdAt: r.created_at,
  settledAt: r.settled_at,
})

export function createSupabaseBackend(url, key) {
  const sb = createClient(url, key, { auth: { persistSession: false } })

  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new Error(error.message.replace(/^.*?:\s*/, '') || 'Something went wrong')
    return data
  }
  const must = ({ data, error }) => {
    if (error) throw new Error(error.message)
    return data
  }

  // Spawn tomorrow's copies of recurring lines at most once a minute per device
  let lastRoll = 0
  const roll = () => {
    if (Date.now() - lastRoll < 60000) return
    lastRoll = Date.now()
    sb.rpc('pp_roll_recurring').then(() => {})
  }

  return {
    mode: 'supabase',

    async load() {
      roll()
      const [settings, players, props, users, lineups] = await Promise.all([
        sb.from('settings').select('trip_name,starting_balance').eq('id', 1).single().then(must),
        sb.from('players').select('*').order('created_at').then(must),
        sb.from('props').select('*').order('created_at').then(must),
        sb.from('app_users').select(USER_COLS).order('created_at').then(must),
        sb.from('lineups').select('*').order('created_at', { ascending: false }).limit(1000).then(must),
      ])
      return {
        settings: { tripName: settings.trip_name, startingBalance: Number(settings.starting_balance) },
        players: players.map(mapPlayer),
        props: props.map(mapProp),
        users: users.map(mapUser),
        lineups: lineups.map(mapLineup),
      }
    },

    subscribe(cb) {
      const ch = sb
        .channel('ticks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ticks' }, () => cb())
        .subscribe()
      const poll = setInterval(cb, 20000)
      const onVis = () => document.visibilityState === 'visible' && cb()
      document.addEventListener('visibilitychange', onVis)
      return () => {
        sb.removeChannel(ch)
        clearInterval(poll)
        document.removeEventListener('visibilitychange', onVis)
      }
    },

    whoami: (token) => rpc('pp_whoami', { p_token: token }),
    signup: ({ name, pin, code }) => rpc('pp_signup', { p_name: name, p_pin: pin, p_code: code }),
    login: async ({ name, pin }) => {
      const r = await rpc('pp_login', { p_name: name, p_pin: pin })
      if (r?.error) throw new Error(r.error)
      return r
    },
    logout: (token) => rpc('pp_logout', { p_token: token }),
    submitLineup: (token, { mode, amount, picks }) =>
      rpc('pp_submit_lineup', {
        p_token: token,
        p_mode: mode,
        p_amount: amount,
        p_picks: picks.map((p) => ({ propId: p.propId, side: p.side })),
      }),
    submitSingles: (token, { amount, picks }) =>
      rpc('pp_submit_singles', { p_token: token, p_amount: amount, p_picks: picks.map((p) => ({ propId: p.propId, side: p.side })) }),
    updateProfile: (token, { avatar }) => rpc('pp_update_profile', { p_token: token, p_avatar: avatar }),

    saveSettings: (token, s) => rpc('pp_save_settings', { p_token: token, p: s }),
    getInviteCode: (token) => rpc('pp_get_invite_code', { p_token: token }),
    savePlayer: (token, p) => rpc('pp_save_player', { p_token: token, p }),
    deletePlayer: (token, id) => rpc('pp_delete_player', { p_token: token, p_id: id }),
    saveProp: (token, p) => rpc('pp_save_prop', { p_token: token, p }),
    addProps: (token, list) => rpc('pp_add_props', { p_token: token, p_list: list }),
    deleteProp: (token, id) => rpc('pp_delete_prop', { p_token: token, p_id: id }),
    updatePropState: (token, id, patch) => rpc('pp_update_prop_state', { p_token: token, p_id: id, p: patch }),
    settleLineup: (token, id, status, payout) =>
      rpc('pp_settle_lineup', { p_token: token, p_id: id, p_status: status, p_payout: payout }),
    adjustBalance: (token, userId, delta) => rpc('pp_adjust_balance', { p_token: token, p_user: userId, p_delta: delta }),
    updateUser: (token, userId, patch) => rpc('pp_update_user', { p_token: token, p_user: userId, p: patch }),
    resetPin: (token, userId, pin) => rpc('pp_reset_pin', { p_token: token, p_user: userId, p_pin: pin }),
  }
}
