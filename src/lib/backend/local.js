// Single-device backend backed by localStorage. Same API as the Supabase backend,
// used for demos and when no Supabase project is configured.
import { validateLineup, propIsPickable, maxMultiplier, round2 } from '../engine'

const KEY = 'pesopicks-db-v1'
const listeners = new Set()

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

function blank() {
  return {
    settings: { tripName: 'Mexico Trip', startingBalance: 1000, inviteCode: 'MEXICO' },
    players: [],
    props: [],
    users: [],
    sessions: {},
    lineups: [],
  }
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank()
  } catch {
    return blank()
  }
}

function write(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((cb) => cb())
}

async function hashPin(name, pin) {
  const data = new TextEncoder().encode(`${name.toLowerCase()}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const publicUser = (u) => {
  const out = { ...u }
  delete out.pin
  return out
}

function requireUser(db, token) {
  const id = db.sessions[token]
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new Error('Please log in again')
  return user
}

function requireAdmin(db, token) {
  const u = requireUser(db, token)
  if (!u.isAdmin) throw new Error('Commissioner only')
  return u
}

function mutate(fn) {
  const db = read()
  const out = fn(db)
  write(db)
  return out
}

export const localBackend = {
  mode: 'local',

  async load() {
    const db = read()
    return {
      settings: { tripName: db.settings.tripName, startingBalance: db.settings.startingBalance },
      players: db.players,
      props: db.props,
      users: db.users.map(publicUser),
      lineups: db.lineups,
    }
  },

  subscribe(cb) {
    listeners.add(cb)
    const onStorage = (e) => e.key === KEY && cb()
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(cb)
      window.removeEventListener('storage', onStorage)
    }
  },

  async whoami(token) {
    const db = read()
    return db.sessions[token] || null
  },

  async signup({ name, pin, code }) {
    name = name.trim()
    if (!name) throw new Error('Enter your name')
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits')
    const pinHash = await hashPin(name, pin)
    return mutate((db) => {
      const first = db.users.length === 0
      if (!first && code.trim().toUpperCase() !== db.settings.inviteCode.toUpperCase()) throw new Error('Wrong trip code')
      if (db.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new Error('Name already taken — log in instead')
      const user = {
        id: uid(),
        name,
        pin: pinHash,
        isAdmin: true,
        balance: Number(db.settings.startingBalance),
        playerId: null,
        avatar: null,
        createdAt: new Date().toISOString(),
      }
      db.users.push(user)
      const token = uid()
      db.sessions[token] = user.id
      return { token, userId: user.id }
    })
  },

  async login({ name, pin }) {
    const pinHash = await hashPin(name.trim(), pin)
    return mutate((db) => {
      const user = db.users.find((u) => u.name.toLowerCase() === name.trim().toLowerCase())
      if (!user || user.pin !== pinHash) throw new Error('Wrong name or PIN')
      const token = uid()
      db.sessions[token] = user.id
      return { token, userId: user.id }
    })
  },

  async logout(token) {
    mutate((db) => {
      delete db.sessions[token]
    })
  },

  async submitLineup(token, { mode, amount, picks }) {
    return mutate((db) => {
      const user = requireUser(db, token)
      const full = picks.map((p) => {
        const prop = db.props.find((x) => x.id === p.propId)
        if (!prop || !propIsPickable(prop)) throw new Error('A pick is no longer available')
        return { propId: prop.id, playerId: prop.playerId, side: p.side, line: prop.line, kind: prop.kind }
      })
      amount = round2(Number(amount))
      const err = validateLineup(full, mode, amount, user.balance)
      if (err) throw new Error(err)
      user.balance = round2(user.balance - amount)
      const lineup = {
        id: uid(),
        userId: user.id,
        mode,
        amount,
        picks: full,
        multiplier: maxMultiplier(mode, full),
        status: 'open',
        payout: 0,
        createdAt: new Date().toISOString(),
        settledAt: null,
      }
      db.lineups.unshift(lineup)
      return lineup
    })
  },

  async updateProfile(token, { avatar }) {
    mutate((db) => {
      const u = requireUser(db, token)
      u.avatar = avatar
    })
  },

  // ---------- commissioner ----------
  async saveSettings(token, s) {
    mutate((db) => {
      requireAdmin(db, token)
      db.settings = { ...db.settings, ...s }
    })
  },
  async getInviteCode(token) {
    const db = read()
    requireAdmin(db, token)
    return db.settings.inviteCode
  },

  async savePlayer(token, p) {
    return mutate((db) => {
      requireAdmin(db, token)
      if (p.id) {
        const i = db.players.findIndex((x) => x.id === p.id)
        db.players[i] = { ...db.players[i], ...p }
        return db.players[i]
      }
      const np = { ...p, id: uid(), createdAt: new Date().toISOString() }
      db.players.push(np)
      return np
    })
  },
  async deletePlayer(token, id) {
    mutate((db) => {
      requireAdmin(db, token)
      if (db.props.some((p) => p.playerId === id)) throw new Error('Delete their props first')
      db.players = db.players.filter((p) => p.id !== id)
    })
  },

  async saveProp(token, p) {
    return mutate((db) => {
      requireAdmin(db, token)
      if (p.id) {
        const i = db.props.findIndex((x) => x.id === p.id)
        db.props[i] = { ...db.props[i], ...p }
        return db.props[i]
      }
      const np = { status: 'open', current: 0, result: null, kind: 'standard', ...p, id: uid(), createdAt: new Date().toISOString() }
      db.props.push(np)
      return np
    })
  },
  async addProps(token, list) {
    mutate((db) => {
      requireAdmin(db, token)
      list.forEach((p) =>
        db.props.push({ status: 'open', current: 0, result: null, kind: 'standard', ...p, id: uid(), createdAt: new Date().toISOString() }),
      )
    })
  },
  async deleteProp(token, id) {
    mutate((db) => {
      requireAdmin(db, token)
      if (db.lineups.some((l) => l.picks.some((p) => p.propId === id))) throw new Error('Someone picked this — void it instead')
      db.props = db.props.filter((p) => p.id !== id)
    })
  },
  async updatePropState(token, id, patch) {
    mutate((db) => {
      requireAdmin(db, token)
      const p = db.props.find((x) => x.id === id)
      Object.assign(p, patch)
    })
  },

  // Apply a computed settlement; reverses any previous payout first.
  async settleLineup(token, lineupId, status, payout) {
    mutate((db) => {
      requireAdmin(db, token)
      const l = db.lineups.find((x) => x.id === lineupId)
      const u = db.users.find((x) => x.id === l.userId)
      if (l.payout) u.balance = round2(u.balance - l.payout)
      l.status = status
      l.payout = status === 'open' ? 0 : round2(payout)
      l.settledAt = status === 'open' ? null : new Date().toISOString()
      if (l.payout) u.balance = round2(u.balance + l.payout)
    })
  },

  async adjustBalance(token, userId, delta) {
    mutate((db) => {
      requireAdmin(db, token)
      const u = db.users.find((x) => x.id === userId)
      u.balance = round2(u.balance + Number(delta))
    })
  },
  async updateUser(token, userId, patch) {
    mutate((db) => {
      requireAdmin(db, token)
      const u = db.users.find((x) => x.id === userId)
      if ('isAdmin' in patch) u.isAdmin = !!patch.isAdmin
      if ('playerId' in patch) u.playerId = patch.playerId || null
    })
  },
  async resetPin(token, userId, pin) {
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits')
    const db0 = read()
    const target = db0.users.find((x) => x.id === userId)
    const h = await hashPin(target.name, pin)
    mutate((db) => {
      requireAdmin(db, token)
      db.users.find((x) => x.id === userId).pin = h
    })
  },
}
