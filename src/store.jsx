import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './lib/backend'
import { settleLineup, MAX_PICKS, propIsPickable, resolveMode } from './lib/engine'

const MAX_SINGLES = 12

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const SESSION_KEY = 'pesopicks-session'
const SLIP_KEY = 'pesopicks-slip'

const loadJSON = (k, fallback) => {
  try {
    const v = localStorage.getItem(k)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
const saveJSON = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

const EMPTY = { settings: { tripName: '', startingBalance: 1000 }, players: [], props: [], users: [], lineups: [] }

export function StoreProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [session, setSession] = useState(() => loadJSON(SESSION_KEY, null))
  const [slip, setSlip] = useState(() => loadJSON(SLIP_KEY, { picks: [], mode: 'power', amount: 10 }))
  const [toast, setToast] = useState(null)
  const [now, setNow] = useState(Date.now())
  const toastTimer = useRef()

  const showToast = useCallback((msg, kind = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, kind, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const d = await api.load()
      setData(d)
      setLoaded(true)
      return d
    } catch (e) {
      showToast(e.message || 'Could not load', 'error')
      setLoaded(true)
      return null
    }
  }, [showToast])

  useEffect(() => {
    refresh()
    return api.subscribe(() => refresh())
  }, [refresh])

  // Tick every 30s so props lock on time
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    saveJSON(SESSION_KEY, session)
  }, [session])
  useEffect(() => {
    saveJSON(SLIP_KEY, slip)
  }, [slip])

  // Validate stored session on boot
  useEffect(() => {
    if (!session) return
    api
      .whoami(session.token)
      .then((id) => {
        if (!id) setSession(null)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playersById = useMemo(() => Object.fromEntries(data.players.map((p) => [p.id, p])), [data.players])
  const propsById = useMemo(() => Object.fromEntries(data.props.map((p) => [p.id, p])), [data.props])
  const usersById = useMemo(() => Object.fromEntries(data.users.map((u) => [u.id, u])), [data.users])
  const me = session ? usersById[session.userId] || null : null

  const pickCounts = useMemo(() => {
    const c = {}
    data.lineups.forEach((l) => l.picks.forEach((p) => (c[p.propId] = (c[p.propId] || 0) + 1)))
    return c
  }, [data.lineups])

  // Drop slip picks that are no longer available
  useEffect(() => {
    if (!loaded) return
    const valid = slip.picks.filter((p) => propsById[p.propId] && propIsPickable(propsById[p.propId], now))
    if (valid.length !== slip.picks.length) setSlip((s) => ({ ...s, picks: valid }))
  }, [loaded, propsById, now, slip.picks])

  const run = useCallback(
    async (fn, okMsg) => {
      try {
        const r = await fn()
        if (okMsg) showToast(okMsg, 'success')
        await refresh()
        return r ?? true
      } catch (e) {
        showToast(e.message || 'Something went wrong', 'error')
        return false
      }
    },
    [refresh, showToast],
  )

  const togglePick = useCallback(
    (prop, side) => {
      if (prop.kind !== 'standard' && side === 'less') {
        showToast(`${prop.kind === 'demon' ? 'Demons' : 'Goblins'} are More only`)
        return
      }
      setSlip((s) => {
        const existing = s.picks.find((p) => p.propId === prop.id)
        if (existing) {
          if (existing.side === side) return { ...s, picks: s.picks.filter((p) => p.propId !== prop.id) }
          return { ...s, picks: s.picks.map((p) => (p.propId === prop.id ? { ...p, side } : p)) }
        }
        const singles = s.mode === 'single'
        // Lineups allow one pick per person (PrizePicks rule); singles are separate bets
        const samePlayer = !singles && s.picks.find((p) => p.playerId === prop.playerId)
        if (samePlayer) {
          return { ...s, picks: s.picks.map((p) => (p === samePlayer ? { propId: prop.id, playerId: prop.playerId, side } : p)) }
        }
        const max = singles ? MAX_SINGLES : MAX_PICKS
        if (s.picks.length >= max) {
          showToast(singles ? `Max ${MAX_SINGLES} singles at once` : `Max ${MAX_PICKS} picks per lineup`)
          return s
        }
        return { ...s, picks: [...s.picks, { propId: prop.id, playerId: prop.playerId, side }] }
      })
    },
    [showToast],
  )

  const setSlipField = useCallback((patch) => setSlip((s) => ({ ...s, ...patch })), [])
  const clearSlip = useCallback(() => setSlip((s) => ({ ...s, picks: [] })), [])
  const loadPicks = useCallback(
    (picks) => setSlip((s) => ({ ...s, picks: picks.map(({ propId, playerId, side }) => ({ propId, playerId, side })) })),
    [],
  )

  const submitLineup = useCallback(async () => {
    // Submit as the play type the builder shows (1 pick = single, Flex needs 3+)
    const mode = resolveMode(slip.mode, slip.picks.length)
    const amount = Number(slip.amount)
    const r = await run(() =>
      mode === 'single'
        ? api.submitSingles(session.token, { amount, picks: slip.picks })
        : api.submitLineup(session.token, { mode, amount, picks: slip.picks }),
    )
    if (r) clearSlip()
    return r
  }, [run, session, slip, clearSlip])

  // Recompute every lineup touching a prop and push changed settlements.
  const resettle = useCallback(
    async (propId) => {
      const d = await api.load()
      const byId = Object.fromEntries(d.props.map((p) => [p.id, p]))
      for (const l of d.lineups) {
        if (!l.picks.some((p) => p.propId === propId)) continue
        const s = settleLineup(l, byId)
        if (s.status !== l.status || Math.abs(s.payout - l.payout) > 0.001) {
          await api.settleLineup(session.token, l.id, s.status, s.payout)
        }
      }
    },
    [session],
  )

  const tok = session?.token
  const admin = useMemo(
    () => ({
      saveSettings: (s) => run(() => api.saveSettings(tok, s), 'Settings saved'),
      getInviteCode: () => api.getInviteCode(tok),
      savePlayer: (p) => run(() => api.savePlayer(tok, p), p.id ? 'Friend updated' : 'Friend added'),
      deletePlayer: (id) => run(() => api.deletePlayer(tok, id), 'Friend removed'),
      saveProp: (p) => run(() => api.saveProp(tok, p), p.id ? 'Prop updated' : 'Prop added'),
      addProps: (list) => run(() => api.addProps(tok, list), `${list.length} props added`),
      deleteProp: (id) => run(() => api.deleteProp(tok, id), 'Prop deleted'),
      setCurrent: (id, current) => run(() => api.updatePropState(tok, id, { current })),
      setRecurring: (id, recurring) =>
        run(() => api.updatePropState(tok, id, { recurring }), recurring ? 'Repeats daily 🔁' : 'Stopped repeating'),
      setLocked: (id, locked) => run(() => api.updatePropState(tok, id, { status: locked ? 'locked' : 'open' })),
      grade: (id, result) =>
        run(async () => {
          await api.updatePropState(tok, id, { status: 'final', result, current: result })
          await resettle(id)
        }, 'Graded — lineups settled'),
      void: (id) =>
        run(async () => {
          await api.updatePropState(tok, id, { status: 'void', result: null })
          await resettle(id)
        }, 'Prop voided'),
      reopen: (id) =>
        run(async () => {
          await api.updatePropState(tok, id, { status: 'locked', result: null })
          await resettle(id)
        }, 'Prop reopened for grading'),
      adjustBalance: (userId, delta) => run(() => api.adjustBalance(tok, userId, delta), 'Balance updated'),
      updateUser: (userId, patch) => run(() => api.updateUser(tok, userId, patch), 'Saved'),
      resetPin: (userId, pin) => run(() => api.resetPin(tok, userId, pin), 'PIN reset'),
    }),
    [run, tok, resettle],
  )

  const auth = useMemo(
    () => ({
      signup: async (f) => {
        try {
          const s = await api.signup(f)
          setSession(s)
          await refresh()
          return true
        } catch (e) {
          showToast(e.message, 'error')
          return false
        }
      },
      login: async (f) => {
        try {
          const s = await api.login(f)
          setSession(s)
          await refresh()
          return true
        } catch (e) {
          showToast(e.message, 'error')
          return false
        }
      },
      logout: async () => {
        try {
          await api.logout(tok)
        } catch {
          /* ignore */
        }
        setSession(null)
      },
      updateProfile: (p) => run(() => api.updateProfile(tok, p), 'Profile updated'),
    }),
    [refresh, showToast, tok, run],
  )

  const value = {
    backendMode: api.mode,
    loaded,
    data,
    now,
    me,
    session,
    playersById,
    propsById,
    usersById,
    pickCounts,
    slip,
    togglePick,
    setSlipField,
    clearSlip,
    loadPicks,
    submitLineup,
    admin,
    auth,
    toast,
    showToast,
    refresh,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
