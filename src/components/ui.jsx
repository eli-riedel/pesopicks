import { useEffect, useState } from 'react'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Icon = {
  board: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
      <rect x="3.5" y="5" width="11" height="15" rx="2.5" {...s} />
      <path d="M17.5 7.5l2.2.6a2 2 0 0 1 1.4 2.5l-2.6 9.5" {...s} />
      <path d="M7 9.5h4M7 13h4" {...s} />
    </svg>
  ),
  lineups: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
      <rect x="4.5" y="4" width="15" height="17" rx="2.5" {...s} />
      <path d="M9 3v2.2h6V3M8.5 11h7M8.5 15h4.5" {...s} />
    </svg>
  ),
  feed: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5" {...s} />
      <path d="M8.5 9h7M8.5 12.5h4.5" {...s} />
    </svg>
  ),
  trophy: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5v1.5A3 3 0 0 0 8 10.4M16 6h3.5v1.5a3 3 0 0 1-3.5 2.9M12 13v3.5M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5" {...s} />
    </svg>
  ),
  profile: (p) => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="8.5" {...s} />
      <circle cx="12" cy="10" r="3" {...s} />
      <path d="M6.6 18.2c1.3-1.9 3.2-2.9 5.4-2.9s4.1 1 5.4 2.9" {...s} />
    </svg>
  ),
  search: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
      <circle cx="11" cy="11" r="6.5" {...s} />
      <path d="M16 16l4 4" {...s} />
    </svg>
  ),
  close: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <path d="M6 6l12 12M18 6L6 18" {...s} strokeWidth="2.2" />
    </svg>
  ),
  back: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <path d="M15 5l-7 7 7 7" {...s} strokeWidth="2.2" />
    </svg>
  ),
  chev: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <path d="M9 5l7 7-7 7" {...s} strokeWidth="2.2" />
    </svg>
  ),
  x: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" {...p}>
      <path d="M6 6l12 12M18 6L6 18" {...s} strokeWidth="2.6" />
    </svg>
  ),
  check: (p) => (
    <svg width="10" height="10" viewBox="0 0 24 24" {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" {...s} strokeWidth="3.4" />
    </svg>
  ),
  // circle arrow used on More/Less buttons (matches PrizePicks' CardArrows)
  up: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="9" {...s} strokeWidth="1.8" />
      <path d="M12 16.5v-9M8.2 11.2L12 7.4l3.8 3.8" {...s} strokeWidth="1.8" />
    </svg>
  ),
  down: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="9" {...s} strokeWidth="1.8" />
      <path d="M12 7.5v9M8.2 12.8l3.8 3.8 3.8-3.8" {...s} strokeWidth="1.8" />
    </svg>
  ),
  shield: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
      <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" {...s} />
      <path d="M9 12l2 2 4-4" {...s} />
    </svg>
  ),
  share: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
      <path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" {...s} />
    </svg>
  ),
  logout: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...p}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" {...s} />
    </svg>
  ),
  copy: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" {...s} />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" {...s} />
    </svg>
  ),
}

export function BrandMark(props) {
  return (
    <svg viewBox="0 0 64 64" className="brand-mark" {...props}>
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#985cfc" />
          <stop offset="1" stopColor="#5202a7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#bm)" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#6eff00" strokeWidth="4.5" />
      <path
        d="M38.5 25.5c-1.2-2.2-3.6-3.3-6.5-3.3-3.8 0-6.4 1.9-6.4 4.8 0 6.4 13.4 3.6 13.4 10.2 0 3-2.9 5-7 5-3.2 0-5.8-1.3-7-3.7M32 18.5v27"
        fill="none"
        stroke="#fbf9ff"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Goblin({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Goblin">
      <circle cx="16" cy="17" r="11" fill="#2fbf3a" stroke="#0b3d10" strokeWidth="1.5" />
      <path d="M5 13l-4-4 6 1zM27 13l4-4-6 1z" fill="#2fbf3a" stroke="#0b3d10" strokeWidth="1.2" />
      <circle cx="12" cy="15.5" r="2" fill="#fff" />
      <circle cx="20" cy="15.5" r="2" fill="#fff" />
      <circle cx="12.4" cy="15.8" r="1" fill="#000" />
      <circle cx="20.4" cy="15.8" r="1" fill="#000" />
      <path d="M11 21.5c3 2.4 7 2.4 10 0" stroke="#0b3d10" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Demon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Demon">
      <path d="M7 10L5 2l7 5M25 10l2-8-7 5" fill="#ff4a4a" stroke="#4a0606" strokeWidth="1.2" />
      <circle cx="16" cy="18" r="11" fill="#ff4a4a" stroke="#4a0606" strokeWidth="1.5" />
      <path d="M9.5 14.5l5 2M22.5 14.5l-5 2" stroke="#4a0606" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1.4" fill="#fff" />
      <circle cx="20" cy="17.5" r="1.4" fill="#fff" />
      <path d="M11 22.5c3 2 7 2 10 0" stroke="#4a0606" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export const KindBadge = ({ kind, size }) =>
  kind === 'goblin' ? <Goblin size={size} /> : kind === 'demon' ? <Demon size={size} /> : null

export const PALETTE = ['#8000ff', '#00afff', '#ff4a4a', '#ffd600', '#2fbf3a', '#ff8a00', '#dd23bb', '#2d62ff', '#14b8a6', '#f472b6']

export function colorFor(id = '') {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function Avatar({ player, user, size = 40, ring }) {
  const src = player?.photo || user?.avatar
  const name = player?.nickname || player?.name || user?.name || '?'
  const color = player?.color || colorFor(player?.id || user?.id)
  const style = {
    width: size,
    height: size,
    background: src ? 'var(--chip)' : `linear-gradient(145deg, ${color}, ${color}88)`,
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
  }
  if (src)
    return (
      <div className="avatar" style={style}>
        <img src={src} alt={name} />
      </div>
    )
  if (player?.emoji)
    return (
      <div className="avatar" style={style}>
        <span className="emoji" style={{ fontSize: size * 0.56 }}>
          {player.emoji}
        </span>
      </div>
    )
  return (
    <div className="avatar" style={style}>
      <span className="init" style={{ fontSize: size * 0.45 }}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    </div>
  )
}

export const CATEGORY_ICONS = {
  popular: '🔥',
  quotes: '💬',
  drinks: '🍺',
  shots: '🥃',
  beach: '🏖️',
  pool: '🏊',
  food: '🌮',
  sleep: '😴',
  chaos: '🌪️',
  phone: '📱',
  money: '💸',
  romance: '💘',
  sports: '🏐',
  nightlife: '🪩',
  misc: '🎯',
}
export const catIcon = (c) => CATEGORY_ICONS[(c || '').toLowerCase()] || '🎯'

export function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function Confetti() {
  const [bits] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.6 + Math.random() * 1.4,
      color: ['#6eff00', '#8000ff', '#985cfc', '#ffd600', '#fbf9ff'][i % 5],
      rot: Math.random() * 360,
    })),
  )
  return (
    <div className="confetti">
      {bits.map((b, i) => (
        <i
          key={i}
          style={{
            left: `${b.left}%`,
            background: b.color,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
            transform: `rotate(${b.rot}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// Resize an image file to a small square JPEG data URL (for avatars)
export function fileToAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const ctx = c.getContext('2d')
      const m = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = url
  })
}

export function useLockBody(on) {
  useEffect(() => {
    if (!on) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [on])
}
