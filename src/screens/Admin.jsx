import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../lib/backend'
import { fmtLine, fmtTime, money, parseBulk } from '../lib/engine'
import { SAMPLE_FRIENDS, sampleProps } from '../lib/sample'
import { Avatar, Icon, KindBadge, PALETTE, catIcon, fileToAvatar, useLockBody } from '../components/ui'

const TEMPLATES = [
  { stat: 'Says “___”', line: 2.5, category: 'Quotes' },
  { stat: 'Drinks', line: 5.5, category: 'Drinks' },
  { stat: 'Shots', line: 2.5, category: 'Shots' },
  { stat: 'Minutes late', line: 10.5, category: 'Chaos' },
  { stat: 'Hours of sleep', line: 6.5, category: 'Sleep' },
  { stat: 'Tacos eaten', line: 5.5, category: 'Food' },
  { stat: '___ (Yes = More)', line: 0.5, category: 'Chaos' },
]
const PRESET_CATS = ['Quotes', 'Drinks', 'Shots', 'Food', 'Beach', 'Pool', 'Chaos', 'Sleep', 'Phone', 'Nightlife', 'Sports', 'Romance', 'Money', 'Misc']

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}
const quickTime = (hour, dayOffset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const blankProp = { id: null, playerId: '', stat: '', line: 2.5, category: 'Quotes', kind: 'standard', event: '', startsAt: null }

function PropForm({ players, editing, onDone }) {
  const { admin, data } = useStore()
  const [f, setF] = useState(editing || blankProp)
  const [customCat, setCustomCat] = useState(false)
  const statRef = useRef()
  useEffect(() => {
    if (editing) setF(editing)
  }, [editing])
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const cats = useMemo(() => [...new Set([...PRESET_CATS, ...data.props.map((p) => p.category)])], [data.props])

  const submit = async (e) => {
    e.preventDefault()
    if (!f.playerId) return
    const ok = await admin.saveProp({ ...f, line: Number(f.line), id: f.id || undefined })
    if (ok) {
      // keep friend/category/time for rapid entry
      setF((x) => ({ ...blankProp, playerId: x.playerId, category: x.category, startsAt: x.startsAt, event: x.event }))
      onDone?.()
      statRef.current?.focus()
    }
  }

  return (
    <form onSubmit={submit} className="acard" style={{ padding: 14 }}>
      <div className="field">
        <label>Who</label>
        <div className="chipsel">
          {players.map((p) => (
            <button type="button" key={p.id} className={f.playerId === p.id ? 'on' : ''} onClick={() => set({ playerId: p.id })} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
              <Avatar player={p} size={24} /> {p.nickname || p.name}
            </button>
          ))}
        </div>
        {players.length === 0 && <div className="hint">Add friends in the Friends tab first.</div>}
      </div>
      <div className="field">
        <label>Prop</label>
        <input ref={statRef} className="inp" placeholder='e.g. Says "That’s awesome"' value={f.stat} onChange={(e) => set({ stat: e.target.value })} required />
        <div className="chipsel" style={{ marginTop: 8 }}>
          {TEMPLATES.map((t) => (
            <button type="button" key={t.stat} onClick={() => set({ ...t })}>
              {t.stat}
            </button>
          ))}
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Line</label>
          <div className="counter" style={{ height: 50 }}>
            <button type="button" onClick={() => set({ line: Math.max(0, Number(f.line) - 1) })}>
              −
            </button>
            <input
              className="inp"
              style={{ border: 0, background: 'none', textAlign: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, padding: 0 }}
              inputMode="decimal"
              value={f.line}
              onChange={(e) => set({ line: e.target.value.replace(/[^\d.]/g, '') })}
            />
            <button type="button" onClick={() => set({ line: Number(f.line) + 1 })}>
              +
            </button>
          </div>
          <div className="hint">Use .5 lines so there are no ties. Yes/No props = 0.5</div>
        </div>
        <div className="field">
          <label>Type</label>
          <div className="seg" style={{ flexDirection: 'column' }}>
            {['standard', 'goblin', 'demon'].map((k) => (
              <button type="button" key={k} className={f.kind === k ? 'on' : ''} onClick={() => set({ kind: k })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {k !== 'standard' && <KindBadge kind={k} size={16} />}
                {k === 'standard' ? 'Standard' : k === 'goblin' ? 'Goblin 0.8X' : 'Demon 1.5X'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="field">
        <label>Category</label>
        <div className="chipsel">
          {cats.map((c) => (
            <button type="button" key={c} className={f.category === c && !customCat ? 'on' : ''} onClick={() => (setCustomCat(false), set({ category: c }))}>
              {catIcon(c)} {c}
            </button>
          ))}
          <button type="button" className={customCat ? 'on' : ''} onClick={() => setCustomCat(true)}>
            + Custom
          </button>
        </div>
        {customCat && <input className="inp" style={{ marginTop: 8 }} placeholder="Category name" value={f.category} onChange={(e) => set({ category: e.target.value })} />}
      </div>
      <div className="field">
        <label>Where / event (optional)</label>
        <input className="inp" placeholder="e.g. Señor Frog’s, Beach day" value={f.event} onChange={(e) => set({ event: e.target.value })} />
      </div>
      <div className="field">
        <label>Picks lock at</label>
        <input className="inp" type="datetime-local" value={toLocalInput(f.startsAt)} onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        <div className="chipsel" style={{ marginTop: 8 }}>
          <button type="button" onClick={() => set({ startsAt: quickTime(12) })}>Noon</button>
          <button type="button" onClick={() => set({ startsAt: quickTime(19) })}>7 PM</button>
          <button type="button" onClick={() => set({ startsAt: quickTime(21) })}>9 PM</button>
          <button type="button" onClick={() => set({ startsAt: quickTime(12, 1) })}>Tmrw noon</button>
          <button type="button" className={!f.startsAt ? 'on' : ''} onClick={() => set({ startsAt: null })}>
            Manual lock
          </button>
        </div>
      </div>
      <button className="btn" type="submit" disabled={!f.playerId || !f.stat}>
        {f.id ? 'Save changes' : 'Add to board'}
      </button>
      {f.id && (
        <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => (setF(blankProp), onDone?.())}>
          Cancel edit
        </button>
      )}
    </form>
  )
}

function LinesTab() {
  const { data, playersById, admin, pickCounts } = useStore()
  const [editing, setEditing] = useState(null)
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const parsed = useMemo(() => (bulk.trim() ? parseBulk(bulk, data.players) : null), [bulk, data.players])
  const active = data.props.filter((p) => p.status === 'open' || p.status === 'locked')

  return (
    <div style={{ padding: '0 16px' }}>
      <PropForm players={data.players} editing={editing} onDone={() => setEditing(null)} />

      <button className="btn sec" style={{ marginTop: 6 }} onClick={() => setShowBulk((v) => !v)}>
        {showBulk ? 'Hide bulk paste' : '⚡ Bulk paste a whole day'}
      </button>
      {showBulk && (
        <div className="acard" style={{ marginTop: 8, padding: 14 }}>
          <div className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
            One prop per line: <b>Name | Prop | Line | Category | Type | Lock time | Event</b>
            <br />
            Only the first 3 are required. Type = standard / goblin / demon.
          </div>
          <textarea
            className="inp"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Byron | Says "that\'s awesome" | 2.5 | Quotes\nJake | Beers before dinner | 4.5 | Drinks | standard | 2026-10-14 19:00 | Pool bar\nSam | Gets lost (Yes = More) | 0.5 | Chaos'}
          />
          {parsed && (
            <div className="hint">
              {parsed.props.length} ready{parsed.errors.length ? ` · ${parsed.errors.length} problems` : ''}
              {parsed.errors.map((e) => (
                <div key={e} style={{ color: 'var(--yellow)' }}>
                  {e}
                </div>
              ))}
            </div>
          )}
          <button
            className="btn"
            style={{ marginTop: 10 }}
            disabled={!parsed || parsed.props.length === 0}
            onClick={async () => {
              if (await admin.addProps(parsed.props)) setBulk('')
            }}
          >
            Add {parsed?.props.length || 0} props
          </button>
        </div>
      )}

      <div className="grp-h">On the board ({active.length})</div>
      {active.length === 0 && <div className="hint">Nothing live yet.</div>}
      {active.map((p) => {
        const pl = playersById[p.playerId]
        return (
          <div className="acard" key={p.id}>
            <div className="r1">
              <Avatar player={pl} size={36} />
              <div className="t">
                <b>
                  {pl?.nickname || pl?.name} · {fmtLine(p.line)} {p.stat}
                </b>
                <span>
                  {catIcon(p.category)} {p.category} · {fmtTime(p.startsAt)} · {pickCounts[p.id] || 0} picks
                </span>
              </div>
              <KindBadge kind={p.kind} size={20} />
              <span className={`status-tag ${p.status}`}>{p.status}</span>
            </div>
            <div className="r2">
              <button className="mini" onClick={(e) => {
                  setEditing({ ...p })
                  e.currentTarget.closest('.sheet')?.scrollTo({ top: 0, behavior: 'smooth' })
                }}>
                Edit
              </button>
              <button className="mini r" onClick={() => confirm('Delete this prop?') && admin.deleteProp(p.id)}>
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GradeRow({ p }) {
  const { playersById, admin, pickCounts } = useStore()
  const [val, setVal] = useState(null)
  const pl = playersById[p.playerId]
  const grading = val !== null
  return (
    <div className="acard">
      <div className="r1">
        <Avatar player={pl} size={36} />
        <div className="t">
          <b>
            {pl?.nickname || pl?.name} · {p.stat}
          </b>
          <span>
            Line {fmtLine(p.line)} · {pickCounts[p.id] || 0} picks · {fmtTime(p.startsAt)}
          </span>
        </div>
        <KindBadge kind={p.kind} size={20} />
        <span className={`status-tag ${p.status}`}>{p.status}</span>
      </div>
      {p.status === 'final' || p.status === 'void' ? (
        <div className="r2">
          <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>
            {p.status === 'final' ? (
              <>
                Final: <b style={{ color: 'var(--text)' }}>{fmtLine(p.result)}</b> → {Number(p.result) > Number(p.line) ? 'MORE hits' : Number(p.result) < Number(p.line) ? 'LESS hits' : 'Push (void)'}
              </>
            ) : (
              'Voided — picks removed'
            )}
          </span>
          <button className="mini" onClick={() => confirm('Reopen and un-settle lineups?') && admin.reopen(p.id)}>
            Regrade
          </button>
        </div>
      ) : grading ? (
        <div className="r2">
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Final result:</span>
          <div className="counter">
            <button onClick={() => setVal((v) => Math.max(0, Number(v) - 1))}>−</button>
            <span>{fmtLine(val)}</span>
            <button onClick={() => setVal((v) => Number(v) + 1)}>+</button>
          </div>
          <button className="mini l" onClick={async () => (await admin.grade(p.id, Number(val))) && setVal(null)}>
            Confirm
          </button>
          <button className="mini" onClick={() => setVal(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="r2">
          <div className="counter">
            <button onClick={() => admin.setCurrent(p.id, Math.max(0, Number(p.current) - 1))} aria-label="Minus one">
              −
            </button>
            <span>{fmtLine(p.current)}</span>
            <button onClick={() => admin.setCurrent(p.id, Number(p.current) + 1)} aria-label="Plus one">
              +
            </button>
          </div>
          <button className="mini" onClick={() => admin.setLocked(p.id, p.status !== 'locked')}>
            {p.status === 'locked' ? 'Unlock' : 'Lock'}
          </button>
          <button className="mini p" onClick={() => setVal(Number(p.current))}>
            Grade
          </button>
          <button className="mini r" onClick={() => confirm('Void this prop? Picks on it are removed (like a DNP).') && admin.void(p.id)}>
            Void
          </button>
        </div>
      )}
    </div>
  )
}

function LiveTab() {
  const { data, playersById } = useStore()
  const [showDone, setShowDone] = useState(false)
  const pending = data.props.filter((p) => p.status === 'open' || p.status === 'locked')
  const done = data.props.filter((p) => p.status === 'final' || p.status === 'void').reverse()
  const groups = {}
  pending.forEach((p) => (groups[p.playerId] ||= []).push(p))
  return (
    <div style={{ padding: '0 16px' }}>
      <div className="hint" style={{ marginTop: 0 }}>
        Tap + as things happen — everyone’s lineups update live. Grade with the final number to settle all lineups automatically.
      </div>
      {Object.entries(groups).map(([pid, list]) => (
        <div key={pid}>
          <div className="grp-h">
            <Avatar player={playersById[pid]} size={22} /> {playersById[pid]?.nickname || playersById[pid]?.name}
          </div>
          {list.map((p) => (
            <GradeRow key={p.id} p={p} />
          ))}
        </div>
      ))}
      {pending.length === 0 && <div className="empty">Nothing to grade right now.</div>}
      {done.length > 0 && (
        <>
          <button className="btn sec" style={{ marginTop: 18 }} onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide' : 'Show'} graded ({done.length})
          </button>
          {showDone && <div style={{ marginTop: 10 }}>{done.map((p) => <GradeRow key={p.id} p={p} />)}</div>}
        </>
      )}
    </div>
  )
}

function FriendsTab() {
  const { data, admin } = useStore()
  const blank = { id: null, name: '', nickname: '', emoji: '', color: PALETTE[data.players.length % PALETTE.length], photo: null }
  const [f, setF] = useState(blank)
  const fileRef = useRef()
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const save = async (e) => {
    e.preventDefault()
    const ok = await admin.savePlayer({ ...f, id: f.id || undefined, nickname: f.nickname || f.name })
    if (ok) setF({ ...blank, color: PALETTE[(data.players.length + 1) % PALETTE.length] })
  }
  return (
    <div style={{ padding: '0 16px' }}>
      <form className="acard" style={{ padding: 14 }} onSubmit={save}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Upload photo">
            <Avatar player={{ ...f, id: f.id || f.name }} size={72} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => e.target.files?.[0] && set({ photo: await fileToAvatar(e.target.files[0]) })}
          />
          <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>
            Tap to add a photo. {f.photo && <button type="button" className="link" onClick={() => set({ photo: null })}>Remove photo</button>}
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Name</label>
            <input className="inp" value={f.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Card name</label>
            <input className="inp" placeholder="Nickname" value={f.nickname} onChange={(e) => set({ nickname: e.target.value })} />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Emoji</label>
            <input className="inp" placeholder="🤙" value={f.emoji} onChange={(e) => set({ emoji: e.target.value })} />
          </div>
          <div className="field">
            <label>Color</label>
            <div className="chipsel">
              {PALETTE.slice(0, 8).map((c) => (
                <button type="button" key={c} onClick={() => set({ color: c })} style={{ width: 26, height: 26, padding: 0, background: c, boxShadow: f.color === c ? '0 0 0 2px var(--text)' : 'none' }} aria-label={c} />
              ))}
            </div>
          </div>
        </div>
        <button className="btn" type="submit">
          {f.id ? 'Save friend' : 'Add friend'}
        </button>
        {f.id && (
          <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setF(blank)}>
            Cancel
          </button>
        )}
      </form>
      <div className="grp-h">The crew ({data.players.length})</div>
      {data.players.map((p) => (
        <div className="acard" key={p.id}>
          <div className="r1">
            <Avatar player={p} size={40} />
            <div className="t">
              <b>{p.nickname || p.name}</b>
              <span>{data.props.filter((x) => x.playerId === p.id).length} props</span>
            </div>
            <button className="mini" onClick={() => setF({ ...blank, ...p })}>
              Edit
            </button>
            <button className="mini r" onClick={() => confirm(`Remove ${p.name}?`) && admin.deletePlayer(p.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UsersTab() {
  const { data, admin, me, playersById } = useStore()
  return (
    <div style={{ padding: '0 16px' }}>
      <div className="hint" style={{ marginTop: 0 }}>
        Everyone who joined the app. Link each person to their friend card so their photo shows up.
      </div>
      {data.users.map((u) => (
        <div className="acard" key={u.id}>
          <div className="r1">
            <Avatar user={u} player={u.playerId ? playersById[u.playerId] : undefined} size={40} />
            <div className="t">
              <b>
                {u.name} {u.isAdmin && <span className="status-tag open">Commish</span>}
              </b>
              <span>{money(u.balance)}</span>
            </div>
          </div>
          <div className="r2">
            <button className="mini l" onClick={() => admin.adjustBalance(u.id, 100)}>
              +$100
            </button>
            <button className="mini r" onClick={() => admin.adjustBalance(u.id, -100)}>
              −$100
            </button>
            <button
              className="mini"
              onClick={() => {
                const v = prompt(`Adjust ${u.name}'s balance by (e.g. 250 or -50):`)
                if (v && !Number.isNaN(Number(v))) admin.adjustBalance(u.id, Number(v))
              }}
            >
              Custom
            </button>
            <select
              className="mini"
              value={u.playerId || ''}
              onChange={(e) => admin.updateUser(u.id, { playerId: e.target.value || null })}
              style={{ border: 0, maxWidth: 130 }}
            >
              <option value="">Link friend…</option>
              {data.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname || p.name}
                </option>
              ))}
            </select>
            {u.id !== me.id && (
              <button className="mini" onClick={() => admin.updateUser(u.id, { isAdmin: !u.isAdmin })}>
                {u.isAdmin ? 'Remove commish' : 'Make commish'}
              </button>
            )}
            <button
              className="mini"
              onClick={() => {
                const pin = prompt(`New 4-digit PIN for ${u.name}:`)
                if (pin) admin.resetPin(u.id, pin)
              }}
            >
              Reset PIN
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SettingsTab() {
  const { data, admin, session, refresh, showToast, backendMode } = useStore()
  const [f, setF] = useState({ tripName: data.settings.tripName, startingBalance: data.settings.startingBalance, inviteCode: '' })
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    admin.getInviteCode().then((c) => setF((x) => ({ ...x, inviteCode: c }))).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const link = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
  const invite = `Join ${f.tripName} on PesoPicks 🌵\n${link}\nTrip code: ${f.inviteCode}`

  const loadSample = async () => {
    setLoading(true)
    try {
      const tok = session.token
      const existing = new Map(data.players.map((p) => [p.name.toLowerCase(), p.id]))
      for (const fr of SAMPLE_FRIENDS) if (!existing.has(fr.name.toLowerCase())) await api.savePlayer(tok, fr)
      const d = await api.load()
      const ids = new Map(d.players.map((p) => [p.name.toLowerCase(), p.id]))
      await api.addProps(
        tok,
        sampleProps().map(([name, stat, line, category, kind, event, startsAt]) => ({ playerId: ids.get(name.toLowerCase()), stat, line, category, kind, event, startsAt })),
      )
      await refresh()
      showToast('Sample crew & lines loaded', 'success')
    } catch (e) {
      showToast(e.message, 'error')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <form
        className="acard"
        style={{ padding: 14 }}
        onSubmit={(e) => {
          e.preventDefault()
          admin.saveSettings({ ...f, startingBalance: Number(f.startingBalance) })
        }}
      >
        <div className="field">
          <label>Trip name</label>
          <input className="inp" value={f.tripName} onChange={(e) => setF({ ...f, tripName: e.target.value })} />
        </div>
        <div className="row2">
          <div className="field">
            <label>Trip code</label>
            <input className="inp" value={f.inviteCode} onChange={(e) => setF({ ...f, inviteCode: e.target.value.toUpperCase() })} />
          </div>
          <div className="field">
            <label>Starting $</label>
            <input className="inp" inputMode="numeric" value={f.startingBalance} onChange={(e) => setF({ ...f, startingBalance: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>
        <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          New people need the trip code to join. Starting $ applies to people who join after you change it.
        </div>
        <button className="btn" type="submit">
          Save settings
        </button>
      </form>
      <div className="acard" style={{ padding: 14 }}>
        <div className="grp-h" style={{ marginTop: 0 }}>
          Invite the crew
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', fontFamily: 'inherit' }}>{invite}</pre>
        <button
          className="btn sec"
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ text: invite })
              else {
                await navigator.clipboard.writeText(invite)
                showToast('Invite copied', 'success')
              }
            } catch {
              /* cancelled */
            }
          }}
        >
          <Icon.share /> Share invite
        </button>
      </div>
      <div className="acard" style={{ padding: 14 }}>
        <div className="grp-h" style={{ marginTop: 0 }}>
          Sample data
        </div>
        <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Adds 6 sample friends and 14 example lines (Byron “That’s awesome” included). Edit or delete them any time.
        </div>
        <button className="btn sec" disabled={loading} onClick={loadSample}>
          {loading ? 'Loading…' : 'Load sample crew & lines'}
        </button>
      </div>
      <div className="note">Backend: {backendMode === 'local' ? 'Local demo (this device only)' : 'Supabase (live sync)'}</div>
    </div>
  )
}

export default function Admin({ onClose }) {
  const [tab, setTab] = useState('lines')
  useLockBody(true)
  return (
    <div className="sheet">
      <div className="sheet-hdr">
        <div className="side">
          <button className="icon-btn" onClick={onClose} aria-label="Back">
            <Icon.back />
          </button>
        </div>
        <h2>Commissioner</h2>
        <div className="side r" />
      </div>
      <div className="atabs">
        {[
          ['lines', '➕ Set Lines'],
          ['live', '📈 Live & Grade'],
          ['friends', '🧑‍🤝‍🧑 Friends'],
          ['users', '👥 Players'],
          ['settings', '⚙️ Settings'],
        ].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ paddingBottom: 'calc(var(--safe-b) + 60px)' }}>
        {tab === 'lines' && <LinesTab />}
        {tab === 'live' && <LiveTab />}
        {tab === 'friends' && <FriendsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

