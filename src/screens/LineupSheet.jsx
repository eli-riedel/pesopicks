import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { POWER, FLEX, flexTiers, maxMultiplier, validateLineup, fmtLine, fmtTime, money, round2, kindFactor, resolveMode, singlesToWin, SINGLE_MULT } from '../lib/engine'
import { Avatar, Confetti, Icon, KindBadge, catIcon, useLockBody } from '../components/ui'

export function SlipBar({ onOpen }) {
  const { slip, playersById, propsById } = useStore()
  const picks = slip.picks.filter((p) => propsById[p.propId])
  if (!picks.length) return null
  const full = picks.map((p) => ({ ...p, kind: propsById[p.propId].kind }))
  const n = picks.length
  const mode = resolveMode(slip.mode, n)
  const sub =
    mode === 'single'
      ? n === 1
        ? `Single Pick · ${maxMultiplier('single', full)}X · add more for a lineup`
        : `${n} Singles · ${SINGLE_MULT}X each`
      : `${mode === 'flex' ? 'Flex' : 'Power'} Play · up to ${maxMultiplier(mode, full)}X`
  return (
    <button className="slipbar" onClick={onOpen}>
      <div className="stack">
        {picks.slice(0, 4).map((p) => (
          <Avatar key={p.propId} player={playersById[p.playerId]} size={30} />
        ))}
      </div>
      <div className="txt">
        <div className="t1">
          {n} {n === 1 ? 'Pick' : 'Picks'} Selected
        </div>
        <div className="t2">{sub}</div>
      </div>
      <Icon.chev />
    </button>
  )
}

export default function LineupSheet({ onClose, onViewLineups }) {
  const { slip, propsById, playersById, togglePick, setSlipField, clearSlip, submitLineup, me } = useStore()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  useLockBody(true)

  const picks = useMemo(
    () =>
      slip.picks
        .filter((p) => propsById[p.propId])
        .map((p) => {
          const prop = propsById[p.propId]
          return { ...p, prop, player: playersById[prop.playerId], kind: prop.kind, line: prop.line }
        }),
    [slip.picks, propsById, playersById],
  )
  const n = picks.length
  const mode = resolveMode(slip.mode, n)
  const single = mode === 'single'
  const amount = Number(slip.amount) || 0
  const total = single ? round2(amount * n) : amount
  const toWin = single ? singlesToWin(amount, picks) : round2(amount * maxMultiplier(mode, picks))
  const error = n === 0 ? null : validateLineup(picks, mode, amount, me?.balance ?? 0)
  const f = kindFactor(picks)

  const submit = async () => {
    setBusy(true)
    const snapshot = { n, mode, amount: total, toWin }
    const ok = await submitLineup()
    setBusy(false)
    if (ok) setDone(snapshot)
  }

  if (done)
    return (
      <div className="modal-bg">
        <Confetti />
        <div className="modal">
          <div className="big">🎉</div>
          <h3>{done.mode === 'single' ? (done.n === 1 ? 'Pick Submitted!' : `${done.n} Singles Submitted!`) : 'Lineup Submitted!'}</h3>
          <p>
            {done.mode === 'single'
              ? `${done.n === 1 ? 'Single Pick' : `${done.n} Singles`}`
              : `${done.n}-Pick ${done.mode === 'flex' ? 'Flex' : 'Power'} Play`}{' '}
            · {money(done.amount)} to pay <b style={{ color: 'var(--lime)' }}>{money(done.toWin)}</b>
          </p>
          <button className="btn" onClick={onViewLineups}>
            View My Lineups
          </button>
          <button className="btn sec" style={{ marginTop: 10 }} onClick={onClose}>
            Back to Board
          </button>
        </div>
      </div>
    )

  return (
    <div className="sheet">
      <div className="sheet-hdr">
        <div className="side">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon.close />
          </button>
        </div>
        <h2>Current Lineup</h2>
        <div className="side r">
          {n > 0 && (
            <button className="link" onClick={clearSlip}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="sheet-body">
        {n === 0 ? (
          <div className="empty">
            <div className="big">🗒️</div>
            <h4>Your lineup is empty</h4>
            <div>Tap More or Less on the board to add picks.</div>
          </div>
        ) : (
          <>
            {picks.map((p) => (
              <div className="prow" key={p.propId}>
                <Avatar player={p.player} size={46} />
                <div className="info">
                  <div className="nm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.player?.nickname || p.player?.name}
                    <KindBadge kind={p.kind} size={18} />
                  </div>
                  <div className="sub">{p.prop.stat}</div>
                  <div className="ev">
                    {catIcon(p.prop.category)} {p.prop.event || p.prop.category} · {fmtTime(p.prop.startsAt)}
                  </div>
                </div>
                <div className="seg2">
                  <div className="ln">{fmtLine(p.line)}</div>
                  <div className="bt">
                    <button className={p.side === 'less' ? 'on' : ''} disabled={p.kind !== 'standard'} onClick={() => togglePick(p.prop, 'less')}>
                      ↓ Less
                    </button>
                    <button className={p.side === 'more' ? 'on' : ''} onClick={() => p.side !== 'more' && togglePick(p.prop, 'more')}>
                      ↑ More
                    </button>
                  </div>
                </div>
                <button className="x" onClick={() => togglePick(p.prop, p.side)} aria-label="Remove">
                  <Icon.x />
                </button>
              </div>
            ))}

            <div className="label">Choose Play Type</div>
            <div className="ptypes">
              <button className={`ptype ${mode === 'power' ? 'on' : ''}`} disabled={n < 2} onClick={() => setSlipField({ mode: 'power' })}>
                <div className="h">
                  Power Play <span className="radio" />
                </div>
                <div className="big">{n >= 2 && POWER[n] ? `${round2(POWER[n] * f)}X` : '—'}</div>
                <div className="d">{n >= 2 ? 'All picks must win. Highest payout.' : 'Add 2+ picks to combine them.'}</div>
              </button>
              <button className={`ptype ${mode === 'flex' ? 'on' : ''}`} disabled={n < 3} onClick={() => setSlipField({ mode: 'flex' })}>
                <div className="h">
                  Flex Play <span className="radio" />
                </div>
                {n >= 3 && FLEX[n] ? (
                  <>
                    <div className="big">{round2(FLEX[n][n] * f)}X</div>
                    {flexTiers(n, picks)
                      .slice(1)
                      .map((t) => (
                        <div className="tier" key={t.hits}>
                          <span>
                            {t.hits}/{n} correct
                          </span>
                          <b>{t.mult}X</b>
                        </div>
                      ))}
                  </>
                ) : (
                  <div className="d">Add 3+ picks. Win even if you miss one.</div>
                )}
              </button>
              <button className={`ptype wide ${single ? 'on' : ''}`} onClick={() => setSlipField({ mode: 'single' })}>
                <div className="h">
                  {n === 1 ? 'Single Pick' : 'Singles'} <span className="radio" />
                </div>
                <div className="row">
                  <div className="big">{n === 1 ? `${maxMultiplier('single', picks)}X` : `${SINGLE_MULT}X`}</div>
                  <div className="d">{n === 1 ? 'Bet this one line on its own.' : `Bet each pick on its own — ${n} separate bets, ${SINGLE_MULT}X each.`}</div>
                </div>
              </button>
            </div>

            <div className="label">{single && n > 1 ? 'Amount per pick' : 'Entry Amount'}</div>
            <div className="amount">
              <span>$</span>
              <input
                inputMode="decimal"
                value={slip.amount}
                style={{ width: `${Math.max(String(slip.amount).length, 1) + 0.6}ch` }}
                onChange={(e) => setSlipField({ amount: e.target.value.replace(/[^\d.]/g, '') })}
                aria-label="Entry amount"
              />
            </div>
            <div className="quick">
              {[5, 10, 20, 50].map((v) => (
                <button key={v} className={amount === v ? 'on' : ''} onClick={() => setSlipField({ amount: v })}>
                  ${v}
                </button>
              ))}
              <button onClick={() => setSlipField({ amount: me ? Math.floor((me.balance / (single ? n : 1)) * 100) / 100 : 0 })}>
                Max
              </button>
            </div>

            <div className="towin">
              <div>
                <div className="k">{single && n > 1 ? `Total (${n} × ${money(amount)})` : 'Entry'}</div>
                <div className="v">{money(total)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="k">{single && n > 1 ? 'If all hit' : 'To Win'}</div>
                <div className="v lime">{money(toWin)}</div>
              </div>
            </div>
            <div className="note">Balance: {money(me?.balance)} · Goblins pay 0.8X, Demons pay 1.5X per pick</div>
          </>
        )}
      </div>
      {n > 0 && (
        <div className="cta-wrap">
          {error && <div className="warn">{error}</div>}
          <button className="btn" disabled={!!error || busy} onClick={submit}>
            {busy ? 'Submitting…' : `${single ? (n === 1 ? 'Submit Pick' : `Submit ${n} Singles`) : 'Submit Lineup'}${!error ? ` · ${money(total)}` : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
