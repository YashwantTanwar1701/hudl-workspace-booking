'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { Booking, UserProfile, Seat, Room, Department } from '../types'
import { buildRoomMap } from '../types'

type BFull = Booking & { seat: Seat; user: UserProfile; department?: Department }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px', ...style }}>
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>{children}</div>
}

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </Card>
  )
}

/* ── Horizontal bar chart ── */
function BarChart({ data, color = '#3b82f6', maxVal }: { data: { label: string; value: number }[]; color?: string; maxVal?: number }) {
  const max = maxVal ?? Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 80, fontSize: 11, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          <div style={{ flex: 1, height: 18, background: 'var(--surface-1)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: color, borderRadius: 4, minWidth: d.value > 0 ? 4 : 0, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ width: 28, fontSize: 11, fontWeight: 700, color: 'var(--ink-700)', textAlign: 'right', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Monthly line/area chart (SVG) ── */
function AreaChart({ data, color = '#3b82f6' }: { data: { label: string; value: number }[]; color?: string }) {
  if (data.length < 2) return <div style={{ fontSize: 12, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Not enough data</div>
  const W = 480, H = 120, PAD = { t: 10, r: 10, b: 28, l: 36 }
  const max = Math.max(...data.map(d => d.value), 1)
  const xs = data.map((_, i) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r))
  const ys = data.map(d => PAD.t + (1 - d.value / max) * (H - PAD.t - PAD.b))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const area = `${line} L${xs[xs.length-1]},${H - PAD.b} L${xs[0]},${H - PAD.b} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="3" fill={color} />
          <text x={xs[i]} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">{d.label}</text>
        </g>
      ))}
      {[0, Math.round(max/2), max].map((v, i) => {
        const y = PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
        return <text key={i} x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize="9" fill="var(--muted)" fontFamily="inherit">{v}</text>
      })}
    </svg>
  )
}

/* ── Donut chart ── */
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let angle = -90
  const R = 45, CX = 60, CY = 60
  const slices = data.map(d => {
    const deg = (d.value / total) * 360
    const start = angle
    angle += deg
    return { ...d, start, deg }
  })
  function arc(start: number, deg: number) {
    if (deg >= 359.9) return `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R} Z`
    const r1 = (start * Math.PI) / 180, r2 = ((start + deg) * Math.PI) / 180
    return `M ${CX + R * Math.cos(r1)} ${CY + R * Math.sin(r1)} A ${R} ${R} 0 ${deg > 180 ? 1 : 0} 1 ${CX + R * Math.cos(r2)} ${CY + R * Math.sin(r2)}`
  }
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 120 120" style={{ width: 100, height: 100, flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={arc(s.start, s.deg)} fill="none" stroke={s.color} strokeWidth="16" />)}
        <circle cx={CX} cy={CY} r={R - 16} fill="var(--card-bg)" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink-900)" fontFamily="inherit">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-700)' }}>{d.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--ink-900)', marginLeft: 'auto', paddingLeft: 8 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Day-of-week heatmap ── */
function DayHeatmap({ data }: { data: Record<string, number> }) {
  const max = Math.max(...Object.values(data), 1)
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {DAYS.map(d => {
        const v = data[d] || 0
        const pct = v / max
        // Background: empty → neutral, low → light blue, high → dark blue
        const bg = pct === 0 ? 'var(--surface-1)' :
          pct < 0.25 ? '#bfdbfe' : pct < 0.5 ? '#60a5fa' : pct < 0.75 ? '#2563eb' : '#1e3a5f'
        // Text colour: always dark on light cells (#bfdbfe, #60a5fa), always white on dark cells
        // Use explicit hex so it's correct in both light and dark theme
        const textColor = pct === 0 ? '#94a3b8' : pct < 0.5 ? '#1e3a5f' : '#ffffff'
        return (
          <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: 48, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: textColor, transition: 'background 0.3s', letterSpacing: '-0.02em' }}>{v}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{d}</div>
          </div>
        )
      })}
    </div>
  )
}


// ─── Sortable table utility ───
function useSortTable<T>(data: T[]) {
  const [sortKey, setSortKey] = React.useState('')
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('asc')
  function onSort(k: string) { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc') } }
  const sorted = React.useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a: any, b: any) => {
      const av = String(a[sortKey] ?? '').toLowerCase(), bv = String(b[sortKey] ?? '').toLowerCase()
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])
  const thStyle = (k: string): React.CSSProperties => ({ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: sortKey === k ? '#2563eb' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' })
  const arrow = (k: string) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'
  return { sorted, thStyle, arrow }
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const isAdmin = profile?.role === 'admin'

  const [bookings, setBookings] = useState<BFull[]>([])
  const [bkTableSort, setBkTableSort] = useState({ key: '', dir: 'asc' as 'asc'|'desc' })
  const [userTableSort, setUserTableSort] = useState({ key: '', dir: 'asc' as 'asc'|'desc' })
  function tableSort<T>(data: T[], s: { key: string; dir: 'asc'|'desc' }): T[] {
    if (!s.key) return data
    return [...data].sort((a: any, b: any) => {
      const av = String(a[s.key] ?? '').toLowerCase(), bv = String(b[s.key] ?? '').toLowerCase()
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return s.dir === 'asc' ? cmp : -cmp
    })
  }
  function sortToggle(key: string, state: { key: string; dir: 'asc'|'desc' }, setter: React.Dispatch<React.SetStateAction<{ key: string; dir: 'asc'|'desc' }>>) {
    setter(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }
  function thS(key: string, state: { key: string; dir: 'asc'|'desc' }): React.CSSProperties {
    return { padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: state.key === key ? '#2563eb' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }
  }
  function arrD(key: string, state: { key: string; dir: 'asc'|'desc' }) { return state.key === key ? (state.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕' }
  const [allBookings, setAllBookings] = useState<BFull[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  // Filters
  const today = new Date()
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toLocaleDateString('en-CA') })
  const [to, setTo] = useState(() => today.toLocaleDateString('en-CA'))

  // User filter (admin only, multi-select)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [userSearchQ, setUserSearchQ] = useState('')

  useEffect(() => { if (!authLoading && !user) router.replace('/') }, [user, authLoading])
  useEffect(() => { if (user && !loading) return; if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    const [bRes, rRes, uRes] = await Promise.all([
      supabase.from('bookings').select('*, seat:seats(*), user:users(*), department:department(*)').eq('user_id', user!.id).gte('booking_date', from).lte('booking_date', to).order('booking_date', { ascending: false }),
      supabase.from('room').select('*'),
      isAdmin ? supabase.from('users').select('*').order('name') : Promise.resolve({ data: null, error: null }),
    ])
    if (bRes.data) setBookings(bRes.data as BFull[])
    if (rRes.data) setRooms(rRes.data as Room[])
    if (uRes.data) setAllUsers(uRes.data as UserProfile[])
    if (isAdmin) {
      const abRes = await supabase.from('bookings').select('*, seat:seats(*), user:users(*), department:department(*)').gte('booking_date', from).lte('booking_date', to).order('booking_date', { ascending: false }).range(0, 4999)
      if (abRes.data) setAllBookings(abRes.data as BFull[])
    }
    setLoading(false)
  }

  useEffect(() => { if (user) fetchAll() }, [from, to])

  const roomMap = useMemo(() => buildRoomMap(rooms), [rooms])

  // Per-user filtered bookings for the "User Analysis" tab
  const userFilteredBookings = useMemo(() => {
    if (!selectedUsers.length) return allBookings
    return allBookings.filter(b => selectedUsers.includes(b.user_id))
  }, [allBookings, selectedUsers])

  /* ── Derived stats for MY bookings ── */
  const myActive = bookings.filter(b => b.status === 'active').length
  const myCancelled = bookings.filter(b => b.status === 'cancelled').length
  const myHours = bookings.filter(b => b.status === 'active').reduce((s, b) => {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    let m = (eh * 60 + em) - (sh * 60 + sm); if (m < 0) m += 1440
    return s + m / 60
  }, 0)

  /* ── Derived stats for ALL bookings (admin) ── */
  function computeStats(bks: BFull[]) {
    const active = bks.filter(b => b.status === 'active')
    const cancelled = bks.filter(b => b.status === 'cancelled')
    const uniqueUsers = new Set(active.map(b => b.user_id)).size

    // Top 10 users by booking count
    const userCounts: Record<string, { name: string; count: number }> = {}
    active.forEach(b => {
      const uid = b.user_id
      if (!userCounts[uid]) userCounts[uid] = { name: b.user?.name || b.user?.email?.split('@')[0] || uid, count: 0 }
      userCounts[uid].count++
    })
    const top10 = Object.values(userCounts).sort((a, b) => b.count - a.count).slice(0, 10)

    // Bookings by zone
    const zoneCounts: Record<string, number> = {}
    active.forEach(b => {
      const name = b.seat?.room_id ? roomMap[b.seat.room_id]?.name || 'Unknown' : 'Unknown'
      zoneCounts[name] = (zoneCounts[name] || 0) + 1
    })
    const byZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }))

    // Monthly booking volume
    const monthlyCounts: Record<string, number> = {}
    active.forEach(b => {
      const d = new Date(b.booking_date)
      const key = `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1
    })
    const monthly = Object.entries(monthlyCounts).sort((a, b) => a[0] > b[0] ? 1 : -1).map(([label, value]) => ({ label, value }))

    // Day of week
    const dayData: Record<string, number> = {}
    DAYS.forEach(d => { dayData[d] = 0 })
    active.forEach(b => { const d = DAYS[new Date(b.booking_date).getDay()]; dayData[d] = (dayData[d] || 0) + 1 })

    // OS breakdown
    const osCounts: Record<string, number> = { macOS: 0, Windows: 0, 'Seat Only': 0 }
    active.forEach(b => {
      if (b.seat?.os_type === 'mac') osCounts.macOS++
      else if (b.seat?.os_type === 'windows') osCounts.Windows++
      else osCounts['Seat Only']++
    })

    // Department breakdown
    const deptCounts: Record<string, number> = {}
    active.forEach(b => {
      const d = b.department?.name || 'Unassigned'
      deptCounts[d] = (deptCounts[d] || 0) + 1
    })
    const byDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))

    // Unique booked-for people (from booked_for column, formatted "Name [EMP_ID]")
    const bookedForCounts: Record<string, { name: string; empId: string; count: number }> = {}
    active.forEach(b => {
      if (!b.booked_for) return
      const match = b.booked_for.match(/^(.+?)\s*\[(.+?)\]$/)
      const name  = match ? match[1].trim() : b.booked_for.trim()
      const empId = match ? match[2].trim() : ''
      const key   = empId || name
      if (!bookedForCounts[key]) bookedForCounts[key] = { name, empId, count: 0 }
      bookedForCounts[key].count++
    })
    const topBookedFor   = Object.values(bookedForCounts).sort((a, b) => b.count - a.count).slice(0, 10)
    const uniqueSeatedPeople = Object.keys(bookedForCounts).length

    return { active, cancelled, uniqueUsers, uniqueSeatedPeople, top10, topBookedFor, byZone, monthly, dayData, osCounts, byDept }
  }

  const companyStats = useMemo(() => computeStats(allBookings), [allBookings, roomMap])
  const userAnalysisStats = useMemo(() => computeStats(userFilteredBookings), [userFilteredBookings, roomMap])

  const TABS = isAdmin
    ? [
        { id: 'overview', label: '📊 Overview' },
        { id: 'company',  label: '🏢 Company'  },
        { id: 'useranalysis', label: '👤 User Analysis' },
        { id: 'history',  label: '📋 History'  },
      ]
    : [
        { id: 'overview', label: '📊 My Overview' },
        { id: 'history',  label: '📋 My Bookings' },
      ]

  const inp = (extra?: object) => ({
    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--card-border)',
    fontSize: 12, fontFamily: 'inherit', background: 'var(--muted-bg)',
    color: 'var(--ink-900)', outline: 'none', colorScheme: 'light dark' as const, ...extra,
  })

  if (authLoading) return null

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>
      {/* ── Sticky Header ── */}
      <div style={{ position: 'sticky', top: 60, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)', marginBottom: 2 }}>Analytics</h1>
              <p style={{ color: 'var(--muted)', fontSize: 12 }}>
                {isAdmin ? 'Company-wide insights + personal analytics' : 'Your personal booking analytics'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>From</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp()} />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>To</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp()} />
              <button onClick={fetchAll} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>Apply</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: tab === t.id ? '#1e3a5f' : 'transparent', color: tab === t.id ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>}

        {/* ── MY OVERVIEW ── */}
        {!loading && tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <KPICard label="Total Bookings" value={bookings.length} color="#2563eb" />
              <KPICard label="Active" value={myActive} color="#15803d" />
              <KPICard label="Cancelled" value={myCancelled} color="#dc2626" />
              <KPICard label="Hours Booked" value={Math.round(myHours)} sub="estimated" color="#7c3aed" />
              <KPICard label="Seat Users" value={(() => {
                const ids = new Set<string>()
                bookings.filter(b => b.status === 'active' && b.booked_for).forEach(b => {
                  const m = b.booked_for!.match(/\[(.+?)\]$/)
                  ids.add(m ? m[1] : b.booked_for!)
                })
                return ids.size
              })()} color="#0369a1" sub="booked for" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card>
                <CardTitle>Bookings by Zone</CardTitle>
                <BarChart color="#3b82f6" data={(() => {
                  const z: Record<string, number> = {}
                  bookings.filter(b => b.status === 'active').forEach(b => {
                    const n = b.seat?.room_id ? roomMap[b.seat.room_id]?.name || 'Unknown' : 'Unknown'
                    z[n] = (z[n] || 0) + 1
                  })
                  return Object.entries(z).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value}))
                })()} />
              </Card>
              <Card>
                <CardTitle>Day of Week</CardTitle>
                <DayHeatmap data={(() => {
                  const d: Record<string, number> = {}; DAYS.forEach(x => d[x] = 0)
                  bookings.filter(b => b.status === 'active').forEach(b => { const day = DAYS[new Date(b.booking_date).getDay()]; d[day]++ })
                  return d
                })()} />
              </Card>
            </div>

            {/* Seat users list for this period */}
            {(() => {
              // Build unique seat users keyed by EMP ID (or name if no ID)
              const byEmpId: Record<string, { name: string; empId: string; count: number; lastDate: string }> = {}
              bookings.filter(b => b.status === 'active' && b.booked_for).forEach(b => {
                const match = b.booked_for!.match(/^(.+?)\s*\[(.+?)\]$/)
                const name  = match ? match[1].trim() : b.booked_for!.trim()
                const empId = match ? match[2].trim() : ''
                const key   = empId || name
                if (!byEmpId[key] || b.booking_date > byEmpId[key].lastDate) {
                  // Keep most recent name (handles name changes)
                  byEmpId[key] = { name, empId, count: (byEmpId[key]?.count || 0) + 1, lastDate: b.booking_date }
                } else {
                  byEmpId[key].count++
                }
              })
              const list = Object.values(byEmpId).sort((a, b) => b.count - a.count)
              if (list.length === 0) return null
              return (
                <Card>
                  <CardTitle>👤 Seat Users in This Period ({list.length})</CardTitle>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                          <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                          <th onClick={() => sortToggle('empId', userTableSort, setUserTableSort)} style={thS('empId', userTableSort)}>EMP ID{arrD('empId', userTableSort)}</th>
                          <th onClick={() => sortToggle('name', userTableSort, setUserTableSort)} style={thS('name', userTableSort)}>Name{arrD('name', userTableSort)}</th>
                          <th onClick={() => sortToggle('count', userTableSort, setUserTableSort)} style={thS('count', userTableSort)}>Bookings{arrD('count', userTableSort)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((u, i) => (
                          <tr key={u.empId || u.name} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                            <td style={{ padding: '7px 12px', color: 'var(--ink-300)', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700, color: u.empId ? 'var(--ink-900)' : 'var(--ink-300)' }}>
                              {u.empId || '—'}
                            </td>
                            <td style={{ padding: '7px 12px', color: 'var(--ink-700)' }}>{u.name}</td>
                            <td style={{ padding: '7px 12px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1' }}>{u.count}</span>
                                <span style={{ height: 6, width: Math.max(4, Math.round((u.count / list[0].count) * 80)), background: '#bfdbfe', borderRadius: 3, display: 'inline-block' }} />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            })()}
          </div>
        )}

        {/* ── COMPANY (admin) ── */}
        {!loading && tab === 'company' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <KPICard label="Total Bookings" value={companyStats.active.length + companyStats.cancelled.length} color="#2563eb" />
              <KPICard label="Active Bookings" value={companyStats.active.length} color="#15803d" />
              <KPICard label="Cancelled" value={companyStats.cancelled.length} color="#dc2626" />
              <KPICard label="Unique Users" value={companyStats.uniqueUsers} color="#7c3aed" sub="who booked" />
              <KPICard label="Unique Seat Users" value={companyStats.uniqueSeatedPeople} color="#0369a1" sub="booked for" />
              <KPICard label="Cancel Rate" value={`${companyStats.active.length + companyStats.cancelled.length > 0 ? Math.round(companyStats.cancelled.length / (companyStats.active.length + companyStats.cancelled.length) * 100) : 0}%`} color="#f59e0b" />
            </div>

            {/* Monthly volume */}
            <Card>
              <CardTitle>📈 Monthly Booking Volume</CardTitle>
              <AreaChart data={companyStats.monthly} color="#3b82f6" />
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Top 10 users */}
              <Card>
                <CardTitle>🏆 Top 10 Bookers</CardTitle>
                <BarChart color="#7c3aed" data={companyStats.top10.map(u => ({ label: u.name, value: u.count }))} />
              </Card>
              {/* Top booked-for people */}
              <Card>
                <CardTitle>👤 Top Seat Users (Booked For)</CardTitle>
                {companyStats.topBookedFor.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    No booked-for data yet.<br/>
                    <span style={{ fontSize: 12 }}>Add EMP ID when booking seats for team members.</span>
                  </div>
                ) : (
                  <BarChart color="#0369a1" data={companyStats.topBookedFor.map(u => ({
                    label: u.empId ? `${u.name} [${u.empId}]` : u.name,
                    value: u.count
                  }))} />
                )}
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Day of week */}
              <Card>
                <CardTitle>📅 Booking by Day of Week</CardTitle>
                <DayHeatmap data={companyStats.dayData} />
              </Card>
              {/* OS breakdown */}
              <Card>
                <CardTitle>💻 Booking by OS Type</CardTitle>
                <DonutChart data={[
                  { label: 'macOS',     value: companyStats.osCounts.macOS,     color: '#3b82f6' },
                  { label: 'Windows',   value: companyStats.osCounts.Windows,   color: '#10b981' },
                  { label: 'Seat Only', value: companyStats.osCounts['Seat Only'], color: '#f59e0b' },
                ]} />
              </Card>
            </div>

            {/* By zone + by department */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card>
                <CardTitle>🗺️ Booking by Zone / Space</CardTitle>
                <BarChart color="#059669" data={companyStats.byZone} />
              </Card>
              {companyStats.byDept.length > 0 ? (
                <Card>
                  <CardTitle>🏬 Booking by Department</CardTitle>
                  <BarChart color="#f59e0b" data={companyStats.byDept} />
                </Card>
              ) : <div />}
            </div>
          </div>
        )}

        {/* ── USER ANALYSIS (admin) ── */}
        {!loading && tab === 'useranalysis' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Multi-select user filter */}
            <Card>
              <CardTitle>🔍 Filter by User(s)</CardTitle>
              <div style={{ marginBottom: 10 }}>
                <input
                  placeholder="Search users…"
                  value={userSearchQ}
                  onChange={e => setUserSearchQ(e.target.value)}
                  style={{ ...inp({ width: '100%', marginBottom: 8, boxSizing: 'border-box' as const }) }}
                />
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: 8, background: 'var(--muted-bg)' }}>
                  {allUsers.filter(u => {
                    if (!userSearchQ) return true
                    const q = userSearchQ.toLowerCase()
                    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
                  }).map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--card-border)', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.id)}
                        onChange={e => setSelectedUsers(p => e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id))}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{u.name || '—'}</span>
                      <span style={{ color: 'var(--muted)' }}>{u.email}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 7px', borderRadius: 99, background: u.role === 'admin' ? '#fef3c7' : 'var(--surface-1)', color: u.role === 'admin' ? '#92400e' : 'var(--muted)' }}>{u.role}</span>
                    </label>
                  ))}
                </div>
                {selectedUsers.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedUsers.length} selected</span>
                    <button onClick={() => setSelectedUsers([])} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>Clear all</button>
                  </div>
                )}
              </div>
            </Card>

            {/* Stats for selected users */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <KPICard label="Bookings" value={userAnalysisStats.active.length + userAnalysisStats.cancelled.length} color="#2563eb" />
              <KPICard label="Active" value={userAnalysisStats.active.length} color="#15803d" />
              <KPICard label="Cancelled" value={userAnalysisStats.cancelled.length} color="#dc2626" />
              <KPICard label="Unique Users" value={userAnalysisStats.uniqueUsers} color="#7c3aed" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card>
                <CardTitle>🏆 Top Bookers</CardTitle>
                <BarChart color="#7c3aed" data={userAnalysisStats.top10.map(u => ({ label: u.name, value: u.count }))} />
              </Card>
              <Card>
                <CardTitle>📅 Day of Week</CardTitle>
                <DayHeatmap data={userAnalysisStats.dayData} />
              </Card>
            </div>
            <Card>
              <CardTitle>📈 Booking Volume Over Time</CardTitle>
              <AreaChart data={userAnalysisStats.monthly} color="#7c3aed" />
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card>
                <CardTitle>🗺️ Booking by Zone</CardTitle>
                <BarChart color="#059669" data={userAnalysisStats.byZone} />
              </Card>
              <Card>
                <CardTitle>🏬 Booking by Department</CardTitle>
                {userAnalysisStats.byDept.length > 0
                  ? <BarChart color="#f59e0b" data={userAnalysisStats.byDept} />
                  : <div style={{ fontSize: 12, color: 'var(--muted)' }}>No department data</div>}
              </Card>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {!loading && tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const rows = [
                    ['Date','Seat','Room','Status','Start','End','EMP ID','Name','Department'].join(','),
                    ...bookings.map(b => {
                      const m = b.booked_for?.match(/^(.+?)\s*\[(.+?)\]$/)
                      const name  = m ? m[1].trim() : (b.booked_for || '')
                      const empId = m ? m[2].trim() : ''
                      return [b.booking_date, b.seat?.seat_number||'', b.seat?.room_id ? roomMap[b.seat.room_id]?.name||'' : '', b.status, b.start_time, b.end_time, empId, name, b.department?.name||''].join(',')
                    })
                  ]
                  const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(rows.join('\n')); a.download = 'my-bookings.csv'; a.click()
                }}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}
              >
                ⬇ Export CSV
              </button>
            </div>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <th onClick={() => sortToggle('booking_date', bkTableSort, setBkTableSort)} style={thS('booking_date', bkTableSort)}>Date{arrD('booking_date', bkTableSort)}</th>
                      <th onClick={() => sortToggle('seat_number', bkTableSort, setBkTableSort)} style={thS('seat_number', bkTableSort)}>Seat{arrD('seat_number', bkTableSort)}</th>
                      <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Zone</th>
                      <th onClick={() => sortToggle('start_time', bkTableSort, setBkTableSort)} style={thS('start_time', bkTableSort)}>Time{arrD('start_time', bkTableSort)}</th>
                      <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>EMP ID</th>
                      <th onClick={() => sortToggle('booked_for', bkTableSort, setBkTableSort)} style={thS('booked_for', bkTableSort)}>Name{arrD('booked_for', bkTableSort)}</th>
                      <th style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Dept</th>
                      <th onClick={() => sortToggle('status', bkTableSort, setBkTableSort)} style={thS('status', bkTableSort)}>Status{arrD('status', bkTableSort)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableSort(bookings, bkTableSort).map((b, i) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                        <td style={{ padding: '8px 13px', color: 'var(--ink-700)' }}>{b.booking_date}</td>
                        <td style={{ padding: '8px 13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--ink-900)' }}>{b.seat?.seat_number || '—'}</td>
                        <td style={{ padding: '8px 13px', color: 'var(--ink-700)' }}>{b.seat?.room_id ? roomMap[b.seat.room_id]?.name || '—' : '—'}</td>
                        <td style={{ padding: '8px 13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{b.start_time?.slice(0,5)} – {b.end_time?.slice(0,5)}</td>
                        <td style={{ padding: '8px 13px', fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-700)', fontWeight: 600 }}>
                          {(() => { const m = b.booked_for?.match(/\[(.+?)\]$/); return m ? m[1] : '—' })()}
                        </td>
                        <td style={{ padding: '8px 13px', color: 'var(--ink-700)' }}>
                          {(() => { const m = b.booked_for?.match(/^(.+?)\s*\[/); return m ? m[1].trim() : (b.booked_for || '—') })()}
                        </td>
                        <td style={{ padding: '8px 13px', color: 'var(--muted)' }}>{b.department?.name || '—'}</td>
                        <td style={{ padding: '8px 13px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: b.status === 'active' ? '#dcfce7' : '#f1f5f9', color: b.status === 'active' ? '#15803d' : 'var(--muted)' }}>{b.status}</span>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>No bookings in selected range</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
