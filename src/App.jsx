import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './store'
import Board from './screens/Board'
import LineupSheet, { SlipBar } from './screens/LineupSheet'
import MyLineups from './screens/MyLineups'
import { Feed, Leaderboard, Profile } from './screens/Social'
import Admin from './screens/Admin'
import Login from './screens/Login'
import { Icon } from './components/ui'

const TABS = [
  ['board', 'Board', Icon.board],
  ['lineups', 'My Lineups', Icon.lineups],
  ['feed', 'Feed', Icon.feed],
  ['leaders', 'Leaders', Icon.trophy],
  ['profile', 'Profile', Icon.profile],
]

function Shell() {
  const { me, loaded, toast, data, showToast } = useStore()
  const [tab, setTab] = useState('board')
  const [slipOpen, setSlipOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  // Land on the board whenever a different person logs in
  const meId = me?.id
  useEffect(() => {
    setTab('board')
    setSlipOpen(false)
    setAdminOpen(false)
  }, [meId])

  if (!loaded) return <div className="login" />

  const openCount = me ? data.lineups.filter((l) => l.userId === me.id && l.status === 'open').length : 0
  const onBalance = () => showToast(me?.isAdmin ? 'Add pesos from Commissioner → Players' : 'Need more pesos? Ask the commissioner 🙏')
  const openAdmin = () => setAdminOpen(true)

  return (
    <div className="app">
      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          {toast.msg}
        </div>
      )}
      {!me ? (
        <Login />
      ) : (
        <>
          {tab === 'board' && <Board onOpenAdmin={openAdmin} onBalance={onBalance} />}
          {tab === 'lineups' && <MyLineups onBalance={onBalance} />}
          {tab === 'feed' && <Feed onBalance={onBalance} onOpenSlip={() => setSlipOpen(true)} />}
          {tab === 'leaders' && <Leaderboard onBalance={onBalance} />}
          {tab === 'profile' && <Profile onOpenAdmin={openAdmin} onBalance={onBalance} />}

          {(tab === 'board' || tab === 'feed') && !slipOpen && <SlipBar onOpen={() => setSlipOpen(true)} />}

          <nav className="tabbar">
            {TABS.map(([k, label, icon]) => (
              <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {k === 'lineups' && openCount > 0 && <span className="badge">{openCount}</span>}
                {icon()}
                {label}
              </button>
            ))}
          </nav>

          {slipOpen && (
            <LineupSheet
              onClose={() => setSlipOpen(false)}
              onViewLineups={() => {
                setSlipOpen(false)
                setTab('lineups')
              }}
            />
          )}
          {adminOpen && <Admin onClose={() => setAdminOpen(false)} />}
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
