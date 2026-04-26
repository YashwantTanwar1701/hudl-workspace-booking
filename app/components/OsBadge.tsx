import { OS_META, type OsType } from '../types'

export function OsBadge({ os, size = 'md' }: { os: OsType; size?: 'sm' | 'md' | 'lg' }) {
  const m = OS_META[os]
  const sizes = {
    sm: { fontSize: 10, padding: '2px 6px', iconSize: 11 },
    md: { fontSize: 12, padding: '3px 8px', iconSize: 13 },
    lg: { fontSize: 14, padding: '5px 12px', iconSize: 16 },
  }
  const s = sizes[size]
  return (
    <span className="badge" style={{ background: m.bg, color: m.color, fontSize: s.fontSize, padding: s.padding }}>
      <OsIcon os={os} size={s.iconSize} />
      {m.label}
    </span>
  )
}

export function OsIcon({ os, size = 16 }: { os: OsType; size?: number }) {
  if (os === 'mac') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    )
  }
  if (os === 'windows') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 12V6.75l6-1.32v6.57H3zm17 0V4.08l-9 1.6V12h9zM3 13h6v6.43l-6-1.33V13zm17 0v8.05l-9-1.6V13h9z"/>
      </svg>
    )
  }
  // other — seat only icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>
    </svg>
  )
}
