import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { settleLineup, pickTracking, lineupTitle, flexTiers, effectiveMode, fmtLine, fmtTime, money, POWER } from '../lib/engine'
import { Avatar, Icon, KindBadge, catIcon, timeAgo, useLockBody } from '../components/ui'
import { Header } from './Board'

export function StatusPill({ status, live }) {
  if (status === 'won') return <span className="pill won">Won</span>
  if (status === 'lost') return <span className="pill lost">Lost</span>
  if (status === 'refunded') return <span className="pill refunded">Refunded</span>
  return live ? <span className="pill live">Live</span> : <span className="pill open">Pending</span>
}

export function lineupLive(lineup, propsById) {
  return lineup.picks.some((p) => {
    const pr = propsById[p.propId]
    return pr && (pr.status === 'locked' || pr.status === 'final' || (pr.startsAt && new Date(pr.startsAt) <= new Date()) || pr.current > 0)
  })
}

function ResultDot({ player, result }) {
  return (
    <div className="rdot">
      <Avatar player={player} size={30} />
      {result !== 'pending' && (
        <span className={`mark ${result}`}>{result === 'win' ? <Icon.check /> : result === 'loss' ? <Icon.x width="8" height="8" /> : null}</span>
      )}
    </div>
  )
}

export function LineupCard({ lineup, onOpen }) {
  const { propsById, playersById } = useStore()
  const { results } = settleLineup(lineup, propsById)
  const potential = lineup.status === 'open' ? lineup.amount * lineup.multiplier : lineup.payout
  return (
    <button className={`lcard ${lineup.status}`} onClick={onOpen}>
      <div className="lcard-top">
        <div className="t">
          {lineupTitle(lineup)} <StatusPill status={lineup.status} live={lineupLive(lineup, propsById)} />
        </div>
        <div className="pay">
          {lineup.status === 'won' || lineup.status === 'refunded'
            ? `${money(lineup.amount)} paid ${money(lineup.payout)}`
            : `${money(lineup.amount)} to pay ${money(potential)}`}
        </div>
      </div>
      <div className="lcard-bot">
        {lineup.picks.map((p, i) => (
          <ResultDot key={p.propId} player={playersById[p.playerId]} result={results[i]} />
        ))}
        <span className="meta">{timeAgo(lineup.createdAt)}</span>
      </div>
    </button>
  )
}

export function LineupDetail({ lineup, onClose, owner }) {
  const { propsById, playersById, me, loadPicks } = useStore()
  const [tab, setTab] = useState('lineup')
  useLockBody(true)
  const { results } = settleLineup(lineup, propsById)
  const potential = lineup.status === 'open' ? lineup.amount * lineup.multiplier : lineup.payout
  const n = lineup.picks.length
  const live = n - results.filter((r) => r === 'void').length
  const eff = effectiveMode(lineup.mode, live)

  return (
    <div className="sheet">
      <div className="sheet-hdr">
        <div className="side">
          <button className="icon-btn" onClick={onClose} aria-label="Back">
            <Icon.back />
          </button>
        </div>
        <h2>{owner && owner.id !== me?.id ? `${owner.name}’s Lineup` : 'Lineup'}</h2>
        <div className="side r" />
      </div>
      <div className={`dhero ${lineup.status}`}>
        <div className="t">
          {lineupTitle(lineup)} <StatusPill status={lineup.status} live={lineupLive(lineup, propsById)} />
        </div>
        <div className="pay">
          {lineup.status === 'won' || lineup.status === 'refunded'
            ? `${money(lineup.amount)} paid ${money(lineup.payout)}`
            : `${money(lineup.amount)} to pay ${money(potential)}`}
        </div>
      </div>
      <div className="tabs2">
        <button className={tab === 'lineup' ? 'on' : ''} onClick={() => setTab('lineup')}>
          Lineup
        </button>
        <button className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>
          Details
        </button>
      </div>
      <div style={{ paddingTop: 12, paddingBottom: 'calc(var(--safe-b) + 40px)' }}>
        {tab === 'lineup' ? (
          lineup.picks.map((p, i) => {
            const prop = propsById[p.propId]
            const player = playersById[p.playerId]
            const r = results[i]
            const tr = pickTracking(p, prop)
            const state =
              r === 'void' ? 'Void' : prop?.status === 'final' ? 'Final' : prop?.status === 'locked' || tr.cur > 0 ? 'Live' : fmtTime(prop?.startsAt)
            const col = r === 'loss' || tr.busted ? 'red' : r === 'void' ? 'gray' : ''
            const maxScale = Math.max(Number(p.line) * 1.25, tr.cur, 1)
            const fillPct = Math.min((tr.cur / maxScale) * 100, 100)
            const tickPct = (Number(p.line) / maxScale) * 100
            return (
              <div className="track" key={p.propId}>
                <div className="top">
                  <span className="lg">
                    {catIcon(prop?.category)} {prop?.category}
                  </span>
                  <span>{prop?.event}</span>
                  <span className="state">
                    {r === 'win' ? '✅ ' : r === 'loss' ? '❌ ' : ''}
                    {state}
                  </span>
                </div>
                <div className="mid">
                  <Avatar player={player} size={44} />
                  <div className="who">
                    <b>{player?.nickname || player?.name}</b>
                    <div>{player?.name}</div>
                  </div>
                  <div className="box">
                    {p.side === 'more' ? <Icon.up style={{ color: 'var(--lime)' }} /> : <Icon.down style={{ color: 'var(--blue)' }} />}
                    <span className="n">{fmtLine(p.line)}</span>
                    <span className="s">{prop?.stat}</span>
                    <KindBadge kind={p.kind} size={18} />
                  </div>
                </div>
                <div className="bar">
                  <div className={`fill ${col}`} style={{ width: `${fillPct}%` }} />
                  <div className="tick" style={{ left: `${tickPct}%` }} />
                  <div className={`bub ${col}`} style={{ left: `${Math.max(fillPct, 4)}%` }}>
                    {fmtLine(r === 'void' && prop?.status === 'void' ? 0 : tr.cur)}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '0 16px' }}>
            <div className="kv">
              <span>Play type</span>
              <span>{lineup.mode === 'single' ? 'Single Pick' : lineup.mode === 'flex' ? 'Flex Play' : 'Power Play'}</span>
            </div>
            {lineup.mode !== 'single' && eff !== lineup.mode && live < n && (
              <div className="kv">
                <span>Reverted to</span>
                <span>{eff === 'refund' ? 'Refund' : `${live}-Pick ${eff === 'flex' ? 'Flex' : 'Power'}`}</span>
              </div>
            )}
            <div className="kv">
              <span>Entry</span>
              <span>{money(lineup.amount)}</span>
            </div>
            <div className="kv">
              <span>Max payout</span>
              <span>{money(lineup.amount * lineup.multiplier)}</span>
            </div>
            {lineup.mode === 'single' ? (
              <div className="kv">
                <span>Correct</span>
                <span>{lineup.multiplier}X</span>
              </div>
            ) : lineup.mode === 'power' ? (
              <div className="kv">
                <span>{n}/{n} correct</span>
                <span>{POWER[n]}X</span>
              </div>
            ) : (
              flexTiers(n).map((t) => (
                <div className="kv" key={t.hits}>
                  <span>
                    {t.hits}/{n} correct
                  </span>
                  <span>{t.mult}X</span>
                </div>
              ))
            )}
            <div className="kv">
              <span>Placed</span>
              <span>{new Date(lineup.createdAt).toLocaleString()}</span>
            </div>
            {lineup.settledAt && (
              <div className="kv">
                <span>Settled</span>
                <span>{new Date(lineup.settledAt).toLocaleString()}</span>
              </div>
            )}
            <div className="kv">
              <span>Lineup ID</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{lineup.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="note">Voided picks (skipped or pushed) are removed and the lineup drops to the next size down.</div>
            {owner && owner.id !== me?.id && lineup.status === 'open' && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => {
                  loadPicks(lineup.picks)
                  onClose('slip')
                }}
              >
                Tail this lineup
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MyLineups({ onBalance }) {
  const { data, me } = useStore()
  const [tab, setTab] = useState('open')
  const [openId, setOpenId] = useState(null)
  const mine = useMemo(() => data.lineups.filter((l) => l.userId === me?.id), [data.lineups, me])
  const list = mine.filter((l) => (tab === 'open' ? l.status === 'open' : l.status !== 'open'))
  const sel = mine.find((l) => l.id === openId)

  return (
    <div className="screen">
      <Header onBalance={onBalance} />
      <div style={{ padding: '4px 16px 8px' }}>
        <h1 className="page-title">My Lineups</h1>
      </div>
      <div className="tabs2" style={{ marginBottom: 14 }}>
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>
          Open ({mine.filter((l) => l.status === 'open').length})
        </button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>
          Completed
        </button>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <div className="big">{tab === 'open' ? '🎟️' : '📜'}</div>
          <h4>{tab === 'open' ? 'No open lineups' : 'Nothing settled yet'}</h4>
          <div>{tab === 'open' ? 'Build one from the board.' : 'Settled lineups show up here.'}</div>
        </div>
      ) : (
        list.map((l) => <LineupCard key={l.id} lineup={l} onOpen={() => setOpenId(l.id)} />)
      )}
      {sel && <LineupDetail lineup={sel} owner={me} onClose={() => setOpenId(null)} />}
    </div>
  )
}
