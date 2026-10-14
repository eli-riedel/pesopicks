import { useState } from 'react'
import { useStore } from '../store'
import { BrandMark } from '../components/ui'

export default function Login() {
  const { auth, data } = useStore()
  const first = data.users.length === 0
  const [mode, setMode] = useState(first ? 'signup' : 'login')
  const [f, setF] = useState({ name: '', pin: '', code: '' })
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    await (mode === 'signup' ? auth.signup(f) : auth.login(f))
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="logo">
        <BrandMark />
        <div className="w">PESOPICKS</div>
        <div className="tag">{data.settings.tripName ? `${data.settings.tripName} · ` : ''}Run your trip.</div>
      </div>
      <form onSubmit={submit}>
        <div className="seg" style={{ marginBottom: 18 }}>
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Log In
          </button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            Sign Up
          </button>
        </div>
        <div className="field">
          <label>Your name</label>
          <input className="inp" autoComplete="username" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Byron" required />
        </div>
        <div className="field">
          <label>4-digit PIN</label>
          <input
            className="inp"
            type="password"
            inputMode="numeric"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            maxLength={4}
            value={f.pin}
            onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="••••"
            required
          />
        </div>
        {mode === 'signup' && !first && (
          <div className="field">
            <label>Trip code</label>
            <input className="inp" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="From your commissioner" required />
          </div>
        )}
        {mode === 'signup' && first && (
          <div className="hint" style={{ marginBottom: 14 }}>
            You’re first in — you’ll be the <b style={{ color: 'var(--text)' }}>Commissioner</b> who sets the lines.
          </div>
        )}
        <button className="btn" type="submit" disabled={busy || f.pin.length !== 4 || !f.name.trim()} style={{ marginTop: 8 }}>
          {busy ? 'One sec…' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
      </form>
      <div className="note" style={{ marginTop: 'auto', paddingTop: 30 }}>
        Just for fun with friends — no real money. Fake pesos only.
      </div>
    </div>
  )
}
