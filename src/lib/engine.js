// Pure game logic: payouts, lineup validation and settlement.
// Payout tables mirror PrizePicks' published Power/Flex multipliers.

export const POWER = { 2: 3, 3: 5, 4: 10, 5: 20, 6: 37.5 }

// FLEX[n][hits] = multiplier
export const FLEX = {
  3: { 3: 2.25, 2: 1.25 },
  4: { 4: 5, 3: 1.5 },
  5: { 5: 10, 4: 2, 3: 0.4 },
  6: { 6: 25, 5: 2, 4: 0.4 },
}

// Goblins are easier lines (pay less), Demons are harder lines (pay more).
// Like PrizePicks, both are "More" only.
export const KIND_FACTOR = { standard: 1, goblin: 0.8, demon: 1.5 }

export const MIN_PICKS = 2
export const MAX_PICKS = 6

export const round2 = (n) => Math.round(n * 100) / 100

export function kindFactor(picks) {
  return picks.reduce((f, p) => f * (KIND_FACTOR[p.kind] || 1), 1)
}

// Effective play type once voids are removed (PrizePicks "reverts" lineups).
export function effectiveMode(mode, n) {
  if (n < MIN_PICKS) return 'refund'
  if (mode === 'flex' && n < 3) return 'power'
  return mode
}

export function maxMultiplier(mode, picks) {
  const n = picks.length
  const m = effectiveMode(mode, n)
  if (m === 'refund') return 1
  const base = m === 'power' ? POWER[n] : FLEX[n][n]
  return round2(base * kindFactor(picks))
}

export function flexTiers(n, picks = []) {
  if (!FLEX[n]) return []
  const f = kindFactor(picks)
  return Object.entries(FLEX[n])
    .map(([hits, mult]) => ({ hits: Number(hits), mult: round2(mult * f) }))
    .sort((a, b) => b.hits - a.hits)
}

export function validateLineup(picks, mode, amount, balance) {
  const n = picks.length
  if (n < MIN_PICKS) return `Add at least ${MIN_PICKS} picks`
  if (n > MAX_PICKS) return `Max ${MAX_PICKS} picks per lineup`
  if (mode === 'flex' && n < 3) return 'Flex Play needs 3+ picks'
  const players = new Set(picks.map((p) => p.playerId))
  if (players.size !== n) return 'Only one pick per person'
  if (picks.some((p) => p.kind !== 'standard' && p.side !== 'more')) return 'Goblins & Demons are More only'
  if (!(amount > 0)) return 'Enter an amount'
  if (amount > balance) return 'Not enough balance'
  return null
}

export function propIsPickable(prop, now = Date.now()) {
  if (prop.status !== 'open') return false
  if (prop.startsAt && new Date(prop.startsAt).getTime() <= now) return false
  return true
}

// Result for one pick given its prop: win | loss | void | pending
export function pickResult(pick, prop) {
  if (!prop || prop.status === 'void') return 'void'
  if (prop.status !== 'final' || prop.result == null) return 'pending'
  const r = Number(prop.result)
  const line = Number(pick.line)
  if (r === line) return 'void' // push: treated like a DNP
  const over = r > line
  return (pick.side === 'more') === over ? 'win' : 'loss'
}

// Live status for an unfinished pick (used for progress bars)
export function pickTracking(pick, prop) {
  const cur = prop ? Number(prop.status === 'final' ? prop.result ?? prop.current : prop.current) || 0 : 0
  const line = Number(pick.line)
  const pct = line > 0 ? Math.min(cur / line, 1) : cur > 0 ? 1 : 0
  // A "more" pick is already won once current passes the line (counts only go up)
  const clinched = pick.side === 'more' && cur > line
  const busted = pick.side === 'less' && cur > line
  return { cur, pct, clinched, busted }
}

// Compute settlement for a lineup. Returns { status, payout, results }
// status: open | won | lost | refunded
export function settleLineup(lineup, propsById) {
  const results = lineup.picks.map((p) => pickResult(p, propsById[p.propId]))
  const live = lineup.picks.filter((_, i) => results[i] !== 'void')
  const n = live.length
  const losses = results.filter((r) => r === 'loss').length
  const pending = results.filter((r) => r === 'pending').length
  const amount = Number(lineup.amount)
  const mode = effectiveMode(lineup.mode, n)

  if (mode === 'power' && losses > 0) return { status: 'lost', payout: 0, results }
  if (mode === 'flex') {
    const minHits = Math.min(...Object.keys(FLEX[n]).map(Number))
    if (n - losses < minHits) return { status: 'lost', payout: 0, results }
  }
  if (pending > 0) return { status: 'open', payout: 0, results }
  if (mode === 'refund') return { status: 'refunded', payout: round2(amount), results }

  const f = kindFactor(live)
  const hits = n - losses
  const mult = mode === 'power' ? POWER[n] : FLEX[n][hits] || 0
  const payout = round2(amount * mult * f)
  return { status: payout > 0 ? 'won' : 'lost', payout, results }
}

export function lineupTitle(lineup) {
  return `${lineup.picks.length}-Pick ${lineup.mode === 'flex' ? 'Flex' : 'Power'} Play`
}

export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const moneyShort = (n) => {
  const v = Number(n || 0)
  return '$' + (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
}

export function fmtTime(iso) {
  if (!iso) return 'ANYTIME'
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '')
  return `${day} ${t}`
}

export const fmtLine = (n) => {
  const v = Number(n)
  return Number.isInteger(v) ? String(v) : String(v)
}

// Parse bulk-paste lines:  Name | Prop | Line | Category | Kind | Start | Event
export function parseBulk(text, players) {
  const byName = new Map()
  players.forEach((p) => {
    byName.set(p.name.toLowerCase(), p)
    if (p.nickname) byName.set(p.nickname.toLowerCase(), p)
  })
  const out = []
  const errors = []
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split('|').map((s) => s.trim())
      const [who, stat, lineStr, category, kind, start, event] = parts
      const player = byName.get((who || '').toLowerCase())
      const lineVal = parseFloat(lineStr)
      if (!player) return errors.push(`Line ${i + 1}: no friend named "${who}"`)
      if (!stat) return errors.push(`Line ${i + 1}: missing prop`)
      if (Number.isNaN(lineVal)) return errors.push(`Line ${i + 1}: bad line "${lineStr}"`)
      const k = (kind || 'standard').toLowerCase()
      let startsAt = null
      if (start) {
        const d = new Date(start)
        if (!Number.isNaN(d.getTime())) startsAt = d.toISOString()
      }
      out.push({
        playerId: player.id,
        stat,
        line: lineVal,
        category: category || 'Misc',
        kind: ['goblin', 'demon'].includes(k) ? k : 'standard',
        startsAt,
        event: event || '',
      })
    })
  return { props: out, errors }
}
