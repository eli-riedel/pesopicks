import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { lineupTitle, fmtLine, money, propIsPickable, round2 } from '../lib/engine'
import { Avatar, Icon, fileToAvatar, timeAgo } from '../components/ui'
import { Header } from './Board'
import { LineupDetail, StatusPill, lineupLive } from './MyLineups'

export function Feed({ onBalance, onOpenSlip }) {
  const { data, usersById, playersById, propsById, me, loadPicks, now, showToast } = useStore()
  const [openId, setOpenId] = useState(null)
  const sel = data.lineups.find((l) => l.id === openId)

  const tail = (l) => {
    const ok = l.picks.every((p) => propsById[p.propId] && propIsPickable(propsById[p.propId], now))
    if (!ok) return showToast('Some of those picks are locked now')
    loadPicks(l.picks)
    onOpenSlip()
  }

  return (
    <div className="screen">
      <Header onBalance={onBalance} />
      <div style={{ padding: '4px 16px 14px' }}>
        <h1 className="page-title">Feed</h1>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Every lineup the crew enters. Tail the hot hands.</div>
      </div>
      {data.lineups.length === 0 ? (
        <div className="empty">
          <div className="big">📣</div>
          <h4>Quiet so far</h4>
          <div>When someone enters a lineup it shows up here.</div>
        </div>
      ) : (
        data.lineups.slice(0, 150).map((l) => {
          const u = usersById[l.userId]
          const canTail = l.status === 'open' && l.userId !== me?.id
          return (
            <div className="fcard" key={l.id}>
              <div className="hd">
                <Avatar user={u} player={u?.playerId ? playersById[u.playerId] : undefined} size={38} />
                <div style={{ flex: 1 }}>
                  <div className="n">{u?.name || 'Someone'}</div>
                  <div className="tm">{timeAgo(l.createdAt)}</div>
                </div>
                <StatusPill status={l.status} live={lineupLive(l, propsById)} />
              </div>
              <button className="ttl" style={{ textAlign: 'left', width: '100%' }} onClick={() => setOpenId(l.id)}>
                {lineupTitle(l)} ·{' '}
                <b>
                  {money(l.amount)} to pay {money(l.status === 'open' ? round2(l.amount * l.multiplier) : l.payout)}
                </b>
              </button>
              {l.picks.map((p) => {
                const pl = playersById[p.playerId]
                const pr = propsById[p.propId]
                return (
                  <div className="fpick" key={p.propId}>
                    <Avatar player={pl} size={26} />
                    <div className="s">
                      <b>{pl?.nickname || pl?.name}</b> {pr?.stat}
                    </div>
                    <span className={`dir ${p.side}`}>
                      {p.side === 'more' ? '↑' : '↓'} {fmtLine(p.line)}
                    </span>
                  </div>
                )
              })}
              {canTail && (
                <button className="btn sm" style={{ marginTop: 10, width: '100%' }} onClick={() => tail(l)}>
                  <Icon.copy /> Tail
                </button>
              )}
            </div>
          )
        })
      )}
      {sel && (
        <LineupDetail
          lineup={sel}
          owner={usersById[sel.userId]}
          onClose={(next) => {
            setOpenId(null)
            if (next === 'slip') onOpenSlip()
          }}
        />
      )}
    </div>
  )
}

function useStandings() {
  const { data } = useStore()
  return useMemo(() => {
    return data.users
      .map((u) => {
        const ls = data.lineups.filter((l) => l.userId === u.id)
        const settled = ls.filter((l) => l.status === 'won' || l.status === 'lost')
        const wins = ls.filter((l) => l.status === 'won').length
        const losses = ls.filter((l) => l.status === 'lost').length
        const inPlay = ls.filter((l) => l.status === 'open').reduce((s, l) => s + l.amount, 0)
        const net = round2(u.balance + inPlay - data.settings.startingBalance)
        const best = Math.max(0, ...ls.map((l) => l.payout || 0))
        return { user: u, wins, losses, inPlay, net, total: ls.length, settled: settled.length, best }
      })
      .sort((a, b) => b.user.balance + b.inPlay - (a.user.balance + a.inPlay))
  }, [data])
}

export function Leaderboard({ onBalance }) {
  const { me, playersById, data } = useStore()
  const rows = useStandings()
  const top = rows.slice(0, 3)
  const order = [top[1], top[0], top[2]]
  const heights = [74, 100, 56]
  return (
    <div className="screen">
      <Header onBalance={onBalance} />
      <div style={{ padding: '4px 16px 4px' }}>
        <h1 className="page-title">Leaderboard</h1>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>{data.settings.tripName} · ranked by bankroll (incl. open lineups)</div>
      </div>
      {rows.length >= 2 && (
        <div className="podium">
          {order.map((r, i) =>
            r ? (
              <div className="pod" key={r.user.id}>
                <Avatar user={r.user} player={r.user.playerId ? playersById[r.user.playerId] : undefined} size={i === 1 ? 64 : 52} ring={['#d4d3da', '#ffd600', '#e08a3c'][i]} />
                <div className="nm">{r.user.name}</div>
                <div className="bl">{money(r.user.balance + r.inPlay)}</div>
                <div className="base" style={{ height: heights[i], background: i === 1 ? 'linear-gradient(180deg, var(--purple), var(--purple-800))' : 'var(--card)' }}>
                  {[2, 1, 3][i]}
                </div>
              </div>
            ) : (
              <div key={i} />
            ),
          )}
        </div>
      )}
      <div className="lb">
        {rows.map((r, i) => (
          <div className={`lbrow ${r.user.id === me?.id ? 'me' : ''}`} key={r.user.id}>
            <div className={`rank r${i + 1}`}>{i + 1}</div>
            <Avatar user={r.user} player={r.user.playerId ? playersById[r.user.playerId] : undefined} size={40} />
            <div className="n">
              <b>{r.user.name}</b>
              <span>
                {r.wins}W–{r.losses}L · {r.total} lineups{r.best ? ` · best ${money(r.best)}` : ''}
              </span>
            </div>
            <div className="v">
              <b>{money(r.user.balance + r.inPlay)}</b>
              <div className={r.net >= 0 ? 'up' : 'down'} style={{ fontSize: 12, fontWeight: 700 }}>
                {r.net >= 0 ? '+' : '−'}
                {money(Math.abs(r.net))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Profile({ onOpenAdmin, onBalance }) {
  const { me, auth, data, playersById, backendMode } = useStore()
  const rows = useStandings()
  const mine = rows.find((r) => r.user.id === me?.id)
  const fileRef = useRef()
  const [showInstall, setShowInstall] = useState(false)
  if (!me) return null
  const winPct = mine && mine.settled ? Math.round((mine.wins / mine.settled) * 100) : 0

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const avatar = await fileToAvatar(f, 200)
    auth.updateProfile({ avatar })
  }

  return (
    <div className="screen">
      <Header onBalance={onBalance} />
      <div className="phero">
        <button onClick={() => fileRef.current?.click()} aria-label="Change photo">
          <Avatar user={me} player={me.playerId && !me.avatar ? playersById[me.playerId] : undefined} size={92} ring="var(--purple)" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <div className="nm">{me.name}</div>
        <div className="bal-big">
          <span className="cur">$</span>
          {money(me.balance).slice(1)}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Pesos balance · {me.isAdmin ? 'Commissioner' : 'Player'} · {data.settings.tripName}
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <b>{mine?.total || 0}</b>
          <span>Lineups</span>
        </div>
        <div className="stat">
          <b>{mine?.wins || 0}</b>
          <span>Won</span>
        </div>
        <div className="stat">
          <b>{winPct}%</b>
          <span>Win rate</span>
        </div>
        <div className="stat">
          <b className={mine?.net >= 0 ? 'up' : 'down'}>
            {mine?.net >= 0 ? '+' : '−'}
            {Math.abs(Math.round(mine?.net || 0))}
          </b>
          <span>Net</span>
        </div>
      </div>
      <div className="menu">
        {me.isAdmin && (
          <button onClick={onOpenAdmin}>
            <Icon.shield /> Commissioner Tools <span className="chev">›</span>
          </button>
        )}
        <button onClick={() => setShowInstall((v) => !v)}>
          <Icon.share /> Add to Home Screen <span className="chev">{showInstall ? '⌄' : '›'}</span>
        </button>
        {showInstall && (
          <div style={{ padding: '4px 16px 14px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            <b style={{ color: 'var(--text)' }}>iPhone (Safari):</b> tap the Share button, then “Add to Home Screen”.
            <br />
            <b style={{ color: 'var(--text)' }}>Android (Chrome):</b> tap ⋮, then “Add to Home screen”.
            <br />
            It opens full-screen like a real app.
          </div>
        )}
        <button onClick={() => fileRef.current?.click()}>
          📸 Change profile photo <span className="chev">›</span>
        </button>
        <button onClick={auth.logout}>
          <Icon.logout /> Log Out
        </button>
      </div>
      <div className="note">
        {backendMode === 'local' ? 'Demo mode — data is saved on this device only.' : 'Synced live with your crew.'} No real money — just bragging rights.
      </div>
    </div>
  )
}
