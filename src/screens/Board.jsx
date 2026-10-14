import { memo, useMemo, useState } from 'react'
import { useStore } from '../store'
import { propIsPickable, fmtTime, fmtLine, money } from '../lib/engine'
import { Avatar, BrandMark, Icon, KindBadge, catIcon } from '../components/ui'

export function Header({ onBalance, right }) {
  const { me } = useStore()
  return (
    <header className="hdr">
      <div className="brand">
        <BrandMark />
        <span className="brand-sub">PLAYERS</span>
      </div>
      <div className="hdr-spacer" />
      {me && (
        <button className="bal" onClick={onBalance} aria-label="Balance">
          <span>
            <span className="cur">$</span>
            {money(me.balance).slice(1)}
          </span>
          <span className="plus">+</span>
        </button>
      )}
      {right}
    </header>
  )
}

const fmtCount = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))

export const ProjectionCard = memo(function ProjectionCard({ prop, player, count, side, onPick }) {
  const color = player?.color || '#8000ff'
  const sel = !!side
  const onlyMore = prop.kind !== 'standard'
  return (
    <div className={`pcard ${sel ? 'sel' : ''}`}>
      <div className="pcard-top">
        <div
          className="glow"
          style={{ background: `radial-gradient(120% 90% at 50% 100%, ${color}66 0%, ${color}22 45%, transparent 75%), linear-gradient(180deg, #2c2c39 0%, #1f202d 100%)` }}
        />
        {count > 0 && (
          <span className="flame">
            <span style={{ fontSize: 10 }}>🔥</span>
            {fmtCount(count)}
          </span>
        )}
        <span className="kind-badge">
          <KindBadge kind={prop.kind} />
        </span>
        <Avatar player={player} size={84} />
      </div>
      <div className="pcard-band">
        <span>
          {catIcon(prop.category)} {prop.event || prop.category}
        </span>
        <span>{fmtTime(prop.startsAt)}</span>
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{player?.name !== (player?.nickname || player?.name) ? player?.name : prop.category}</div>
        <div className="pcard-name">{player?.nickname || player?.name}</div>
        <div className="pcard-line">
          <span className="num">{fmtLine(prop.line)}</span>
        </div>
        <div className="pcard-stat">{prop.stat}</div>
      </div>
      <div className="pcard-btns">
        <button
          className={`lm ${side === 'less' ? 'on' : ''} ${onlyMore ? 'off' : ''}`}
          onClick={() => onPick(prop, 'less')}
          aria-pressed={side === 'less'}
        >
          <Icon.down /> Less
        </button>
        <span className="div" />
        <button className={`lm ${side === 'more' ? 'on' : ''}`} onClick={() => onPick(prop, 'more')} aria-pressed={side === 'more'}>
          <Icon.up /> More
        </button>
      </div>
    </div>
  )
})

export default function Board({ onOpenAdmin, onBalance }) {
  const { data, playersById, pickCounts, slip, togglePick, now, me } = useStore()
  const [cat, setCat] = useState('popular')
  const [who, setWho] = useState('all')
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')

  const open = useMemo(() => data.props.filter((p) => propIsPickable(p, now) && playersById[p.playerId]), [data.props, now, playersById])

  const cats = useMemo(() => {
    const c = {}
    open.forEach((p) => (c[p.category] = (c[p.category] || 0) + 1))
    return Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
  }, [open])

  const inCat = useMemo(() => (cat === 'popular' ? open : open.filter((p) => p.category === cat)), [open, cat])

  const people = useMemo(() => {
    const ids = [...new Set(inCat.map((p) => p.playerId))]
    return ids.map((id) => playersById[id]).sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name))
  }, [inCat, playersById])

  const activeWho = who !== 'all' && people.some((p) => p.id === who) ? who : 'all'

  const shown = useMemo(() => {
    let list = activeWho === 'all' ? inCat : inCat.filter((p) => p.playerId === activeWho)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter((p) => {
        const pl = playersById[p.playerId]
        return [p.stat, p.category, p.event, pl?.name, pl?.nickname].some((x) => (x || '').toLowerCase().includes(s))
      })
    }
    return [...list].sort((a, b) =>
      cat === 'popular'
        ? (pickCounts[b.id] || 0) - (pickCounts[a.id] || 0) || String(a.startsAt).localeCompare(String(b.startsAt))
        : String(a.startsAt).localeCompare(String(b.startsAt)) || a.stat.localeCompare(b.stat),
    )
  }, [inCat, activeWho, q, cat, pickCounts, playersById])

  const sideFor = useMemo(() => Object.fromEntries(slip.picks.map((p) => [p.propId, p.side])), [slip.picks])

  return (
    <div className="screen">
      <Header
        onBalance={onBalance}
        right={
          <button className="icon-btn" onClick={() => setSearching((v) => !v)} aria-label="Search">
            <Icon.search />
          </button>
        }
      />
      {searching && (
        <div className="search">
          <Icon.search />
          <input autoFocus placeholder="Search friends or props" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {open.length === 0 ? (
        <div className="empty">
          <div className="big">🌵</div>
          <h4>No lines on the board</h4>
          <div>{me?.isAdmin ? 'Set today’s lines and your crew can start picking.' : 'The commissioner hasn’t posted lines yet. Check back soon.'}</div>
          {me?.isAdmin && (
            <button className="btn sm" style={{ margin: '18px auto 0' }} onClick={onOpenAdmin}>
              Set lines
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="chips">
            <button className={`lchip ${cat === 'popular' ? 'on' : ''}`} onClick={() => setCat('popular')}>
              <span className="ico">🔥</span>Popular
            </button>
            {cats.map((c) => (
              <button key={c} className={`lchip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
                <span className="ico">{catIcon(c)}</span>
                {c}
              </button>
            ))}
          </div>
          <div className="schips">
            <button className={`schip ${activeWho === 'all' ? 'on' : ''}`} onClick={() => setWho('all')}>
              All
            </button>
            {people.map((p) => (
              <button key={p.id} className={`schip ${activeWho === p.id ? 'on' : ''}`} onClick={() => setWho(p.id)}>
                {p.nickname || p.name}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="empty">No matches</div>
          ) : (
            <div className="grid">
              {shown.map((p) => (
                <ProjectionCard
                  key={p.id}
                  prop={p}
                  player={playersById[p.playerId]}
                  count={pickCounts[p.id] || 0}
                  side={sideFor[p.id]}
                  onPick={togglePick}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
