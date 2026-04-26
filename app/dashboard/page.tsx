'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { FLOOR_SECTIONS, OS_META } from '../types'
import type { Booking, Seat, OsType } from '../types'
import {
  TrendingUp, Calendar, Clock, Monitor, Apple,
  Activity, Award, Flame, BarChart2, Download,
  Filter, ArrowUpRight, Zap, Moon, MapPin
} from 'lucide-react'

type BFull = Booking & { seat: Seat }

type RangePreset = 'today' | '3d' | '7d' | '30d' | 'custom'

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '3d',    label: 'Past 3 Days' },
  { id: '7d',    label: 'Past 7 Days' },
  { id: '30d',   label: 'Past 30 Days' },
  { id: 'custom', label: 'Custom Range' },
]

function getRange(preset: RangePreset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date().toISOString().split('T')[0]
  const sub = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
  if (preset === 'today')  return { from: today,    to: today }
  if (preset === '3d')     return { from: sub(2),   to: today }
  if (preset === '7d')     return { from: sub(6),   to: today }
  if (preset === '30d')    return { from: sub(29),  to: today }
  return { from: customFrom || sub(6), to: customTo || today }
}

function sectionEmoji(id: string) {
  if (id.includes('server'))      return '🖥️'
  if (id.includes('town-hall-l')) return '🏢'
  if (id.includes('hr-it'))       return '💼'
  if (id.includes('hr-ops'))      return '⚙️'
  if (id.includes('2s-'))         return '📟'
  if (id.includes('training'))    return '📚'
  if (id.includes('1s-'))         return '📞'
  if (id.includes('wellness'))    return '🧘'
  if (id.includes('conference'))  return '🏛️'
  if (id.includes('meeting'))     return '🤝'
  if (id.includes('product'))     return '🚀'
  if (id.includes('cafeteria'))   return '☕'
  return '💡'
}

function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    blue:   { bg: '#eff6ff', text: '#2563eb' },
    green:  { bg: '#f0fdf4', text: '#15803d' },
    amber:  { bg: '#fffbeb', text: '#d97706' },
    purple: { bg: '#faf5ff', text: '#7c3aed' },
    red:    { bg: '#fef2f2', text: '#dc2626' },
    slate:  { bg: '#f8fafc', text: '#475569' },
  }
  const c = map[color] ?? map.blue
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={17} color={c.text} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SimpleBar({ data, height = 160 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>{d.value || ''}</span>
          <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: d.color ?? '#3b82f6', height: `${(d.value / max) * (height - 28)}px`, transition: 'height 0.4s', minHeight: d.value > 0 ? 3 : 0 }} />
          <span style={{ fontSize: 8, color: '#64748b', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function SimpleLine({ data, height = 110 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 100 / (data.length - 1)
  const pts = data.map((d, i) => `${i * w},${(1 - d.value / max) * (height - 18)}`).join(' ')
  return (
    <div style={{ position: 'relative', height, padding: '0 4px' }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
        <polyline points={`${pts} ${(data.length-1)*w},${height} 0,${height}`} fill="url(#lg)" stroke="none" />
        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
        {[data[0], data[Math.floor(data.length/2)], data[data.length-1]].map((d,i) => <span key={i} style={{ fontSize: 9, color: '#94a3b8' }}>{d.label}</span>)}
      </div>
    </div>
  )
}

function exportCSV(rows: BFull[], filename: string) {
  const headers = ['Seat','Section','OS','Machine #','Date','Start','End','Duration (min)','Status','Booked At']
  const lines = rows.map(b => {
    const [sh,sm] = b.start_time.split(':').map(Number)
    const [eh,em] = b.end_time.split(':').map(Number)
    let mins = (eh*60+em)-(sh*60+sm); if(mins<0) mins+=1440
    const sec = FLOOR_SECTIONS.find(s => s.id === b.seat?.section)
    return [b.seat?.seat_number||'',sec?.label||b.seat?.section||'',b.seat?.os_type||'',b.seat?.machine_number??'',b.booking_date,b.start_time.slice(0,5),b.end_time.slice(0,5),mins,b.status,new Date(b.created_at).toLocaleString('en-IN')].map(v=>`"${v}"`).join(',')
  })
  const csv = [headers.join(','),...lines].join('\n')
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const isAdmin = profile?.role === 'admin'

  const [bookings,    setBookings]    = useState<BFull[]>([])
  const [allBookings, setAllBookings] = useState<BFull[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<'overview'|'patterns'|'sections'|'company'|'history'>('overview')
  const [preset,      setPreset]      = useState<RangePreset>('7d')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [histFilter,  setHistFilter]  = useState<'all'|'active'|'cancelled'>('all')
  const [histSearch,  setHistSearch]  = useState('')

  const { from, to } = getRange(preset, customFrom, customTo)

  useEffect(() => { if (!authLoading && !user) router.push('/auth') }, [user, authLoading])
  useEffect(() => { if (user) fetchData() }, [user, isAdmin, from, to])

  async function fetchData() {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      supabase.from('bookings').select('*, seat:seats(*)').eq('user_id', user!.id).gte('booking_date', from).lte('booking_date', to).order('created_at', { ascending: false }),
      isAdmin ? supabase.from('bookings').select('*, seat:seats(*)').gte('booking_date', from).lte('booking_date', to).order('created_at', { ascending: false }).limit(2000) : Promise.resolve({ data: null }),
    ])
    if (r1.data) setBookings(r1.data as BFull[])
    if (r2.data) setAllBookings(r2.data as BFull[])
    setLoading(false)
  }

  const analytics = useMemo(() => {
    const active = bookings.filter(b => b.status === 'active')
    const totalMins = active.reduce((acc, b) => {
      const [sh,sm] = b.start_time.split(':').map(Number)
      const [eh,em] = b.end_time.split(':').map(Number)
      let m = (eh*60+em)-(sh*60+sm); if(m<0) m+=1440
      return acc+m
    }, 0)
    const dayCounts = Array(7).fill(0)
    active.forEach(b => { const d = new Date(b.booking_date+'T00:00:00').getDay(); dayCounts[d]++ })
    const hourCounts: Record<number,number> = {}
    active.forEach(b => { const h = parseInt(b.start_time); hourCounts[h] = (hourCounts[h]||0)+1 })
    const osCounts: Record<string,number> = { mac:0, windows:0, 'other':0 }
    active.forEach(b => { if (b.seat?.os_type) osCounts[b.seat.os_type]++ })
    const secCounts: Record<string,number> = {}
    active.forEach(b => { if (b.seat?.section) secCounts[b.seat.section]=(secCounts[b.seat.section]||0)+1 })
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const busyDayIdx = dayCounts.indexOf(Math.max(...dayCounts))
    const secEntries = Object.entries(secCounts).sort((a,b)=>b[1]-a[1])
    const favSec = secEntries[0] ? FLOOR_SECTIONS.find(s=>s.id===secEntries[0][0])?.label : '—'

    // Build daily trend for the range
    const days: string[] = []
    const cur = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    while (cur <= end) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1) }
    const trend = days.map(d => ({ label: d.slice(5), value: active.filter(b => b.booking_date === d).length }))
    const byDow = dayNames.map((n,i) => ({ label: n, value: dayCounts[i], color: i===busyDayIdx?'#f59e0b':'#bae6fd' }))
    const secBar = secEntries.slice(0,10).map(([id,cnt]) => ({ label: FLOOR_SECTIONS.find(s=>s.id===id)?.shortLabel||id, value: cnt, color: FLOOR_SECTIONS.find(s=>s.id===id)?.accent||'#3b82f6' }))
    const cancelRate = bookings.length>0?Math.round(((bookings.length-active.length)/bookings.length)*100):0

    return { total:bookings.length, active:active.length, cancelled:bookings.length-active.length, totalHours:Math.round(totalMins/60), avgMins:active.length>0?Math.round(totalMins/active.length):0, busyDay:dayNames[busyDayIdx]||'—', favSec, favSecCount:secEntries[0]?.[1]||0, cancelRate, osCounts, trend, byDow, secBar }
  }, [bookings, from, to])

  const histFiltered = useMemo(() => {
    return bookings.filter(b => {
      if (histFilter !== 'all' && b.status !== histFilter) return false
      if (histSearch) {
        const s = histSearch.toLowerCase()
        return b.seat?.seat_number?.toLowerCase().includes(s) || b.booking_date.includes(s) || FLOOR_SECTIONS.find(sec=>sec.id===b.seat?.section)?.label.toLowerCase().includes(s)
      }
      return true
    })
  }, [bookings, histFilter, histSearch])

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'patterns',  label: 'Patterns' },
    { id: 'sections',  label: 'Sections' },
    ...(isAdmin ? [{ id: 'company', label: 'Company' }] : []),
    { id: 'history',   label: 'History' },
  ] as const

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '18px 24px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 9 }}><BarChart2 size={21} color="#2563eb" /> Analytics</h1>
              <p style={{ color: '#64748b', fontSize: 13 }}>{isAdmin ? 'Company-wide & personal insights' : 'Your workspace usage insights'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Date range presets */}
              <div style={{ display: 'flex', gap: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: 3 }}>
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPreset(p.id)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: preset===p.id?700:500, cursor: 'pointer', fontFamily: 'inherit', background: preset===p.id?'#fff':'transparent', color: preset===p.id?'#0f172a':'#64748b', boxShadow: preset===p.id?'0 1px 3px rgba(0,0,0,0.1)':'none', transition: 'all 0.12s' }}>{p.label}</button>
                ))}
              </div>
              {/* Custom range */}
              {preset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '5px 10px' }}>
                  <Calendar size={12} color="#3b82f6" />
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ fontSize: 12, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 600, color: '#374151' }} />
                  <span style={{ color: '#cbd5e1' }}>→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ fontSize: 12, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 600, color: '#374151' }} />
                </div>
              )}
              <button onClick={() => exportCSV(bookings, `my-bookings-${from}-${to}.csv`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#475569' }}>
                <Download size={12} /> Export CSV
              </button>
              {isAdmin && allBookings.length > 0 && (
                <button onClick={() => exportCSV(allBookings, `all-bookings-${from}-${to}.csv`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#475569' }}>
                  <Download size={12} /> Export All
                </button>
              )}
            </div>
          </div>

          {/* Range label */}
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            Showing: <strong>{from}</strong> to <strong>{to}</strong> · {bookings.length} bookings found
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab===t.id?700:500, fontFamily: 'inherit', color: tab===t.id?'#2563eb':'#64748b', borderBottom: `2.5px solid ${tab===t.id?'#2563eb':'transparent'}`, marginBottom: -1, transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#64748b', gap: 9 }}>
            <Activity size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : (
          <>
            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                  <KpiCard icon={Calendar}    label="Total Bookings"  value={analytics.total}                    color="blue"   />
                  <KpiCard icon={Activity}    label="Active"          value={analytics.active}                   color="green"  />
                  <KpiCard icon={Clock}       label="Hours Booked"    value={`${analytics.totalHours}h`}         sub={`~${analytics.avgMins}m avg`} color="amber" />
                  <KpiCard icon={Zap}         label="Cancel Rate"     value={`${analytics.cancelRate}%`}         color={analytics.cancelRate>25?'red':'slate'} />
                  <KpiCard icon={Flame}       label="Busiest Day"     value={analytics.busyDay}                  color="red"    />
                  <KpiCard icon={MapPin}      label="Top Section"     value={analytics.favSec?.split(' ')[0]||'—'} sub={analytics.favSecCount?`${analytics.favSecCount}×`:''} color="purple" />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={14} color="#3b82f6" /> Booking Trend</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>{from} → {to}</div>
                  <SimpleLine data={analytics.trend} height={130} />
                </div>
                {/* OS distribution */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}><Monitor size={14} color="#10b981" /> OS Distribution</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {(Object.entries(analytics.osCounts) as [string,number][]).map(([os, n]) => {
                      const meta = OS_META[os as OsType]
                      const pct = analytics.active > 0 ? Math.round(n/analytics.active*100) : 0
                      return (
                        <div key={os} style={{ flex: 1, padding: '14px 16px', borderRadius: 10, background: meta.bg, border: `1.5px solid ${meta.color}33` }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: meta.color }}>{n}</div>
                          <div style={{ fontSize: 12, color: meta.color, fontWeight: 600, marginTop: 3 }}>{meta.label}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{pct}% of active</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* PATTERNS */}
            {tab === 'patterns' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>Busiest Days of Week</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Across selected range</div>
                  <SimpleBar data={analytics.byDow} height={170} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Session Stats</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Total Bookings',      value: analytics.total    },
                      { label: 'Active',              value: analytics.active   },
                      { label: 'Cancelled',           value: analytics.cancelled },
                      { label: 'Total Hours Booked',  value: `${analytics.totalHours}h` },
                      { label: 'Avg Session Length',  value: `${analytics.avgMins}m`   },
                      { label: 'Cancel Rate',         value: `${analytics.cancelRate}%` },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#f8fafc', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: '#475569' }}>{item.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECTIONS */}
            {tab === 'sections' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Section Usage</div>
                  {analytics.secBar.length > 0 ? <SimpleBar data={analytics.secBar} height={200} /> : <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No data</div>}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden' }}>
                  <div style={{ padding: '18px 18px 0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}><Award size={14} color="#f59e0b" /> Top Sections</div>
                  </div>
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
                    {analytics.secBar.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', borderRadius: 8, background: i===0?'#fffbeb':'#f8fafc' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: i===0?'#fde68a':'#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: i===0?'#d97706':'#64748b' }}>{i+1}</div>
                        <span style={{ fontSize: 12, flex: 1, color: '#475569' }}>{item.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* COMPANY (admin only) */}
            {tab === 'company' && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                  <KpiCard icon={Calendar} label="All Bookings" value={allBookings.length} color="blue" />
                  <KpiCard icon={Activity} label="Active" value={allBookings.filter(b=>b.status==='active').length} color="green" />
                  <KpiCard icon={Apple}    label="Mac"     value={allBookings.filter(b=>b.seat?.os_type==='mac').length} color="blue" />
                  <KpiCard icon={Monitor}  label="Windows" value={allBookings.filter(b=>b.seat?.os_type==='windows').length} color="green" />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Company Trend</div>
                  {(() => {
                    const days: string[] = []
                    const c = new Date(from+'T00:00:00'), e = new Date(to+'T00:00:00')
                    while(c<=e){days.push(c.toISOString().split('T')[0]);c.setDate(c.getDate()+1)}
                    const trend = days.map(d => ({ label: d.slice(5), value: allBookings.filter(b=>b.booking_date===d&&b.status==='active').length }))
                    return <SimpleLine data={trend} height={130} />
                  })()}
                </div>
              </div>
            )}

            {/* HISTORY */}
            {tab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 3 }}>
                    {(['all','active','cancelled'] as const).map(f => (
                      <button key={f} onClick={() => setHistFilter(f)} style={{ padding: '4px 11px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: histFilter===f?700:500, cursor: 'pointer', fontFamily: 'inherit', background: histFilter===f?'#fff':'transparent', color: histFilter===f?'#0f172a':'#64748b', boxShadow: histFilter===f?'0 1px 3px rgba(0,0,0,0.1)':'none', textTransform: 'capitalize' }}>{f}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 11px', flex: 1, maxWidth: 280 }}>
                    <Filter size={11} color="#94a3b8" />
                    <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search seat, date, section…" style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#374151', background: 'transparent' }} />
                  </div>
                  <button onClick={() => exportCSV(histFiltered, `bookings-${from}-${to}.csv`)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#475569' }}>
                    <Download size={12} /> Export ({histFiltered.length})
                  </button>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          {['Seat','Section','OS','Date','Time','Duration','Status'].map(h => (
                            <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {histFiltered.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No bookings found</td></tr>
                        ) : histFiltered.map((b, i) => {
                          const sec = FLOOR_SECTIONS.find(s => s.id === b.seat?.section)
                          const [sh,sm] = b.start_time.split(':').map(Number)
                          const [eh,em] = b.end_time.split(':').map(Number)
                          let mins = (eh*60+em)-(sh*60+sm); if(mins<0) mins+=1440
                          const os = b.seat?.os_type
                          return (
                            <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9', background: i%2===0?'#fff':'#fafafa', opacity: b.status==='cancelled'?0.6:1 }}>
                              <td style={{ padding: '9px 13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{b.seat?.seat_number||'—'}</td>
                              <td style={{ padding: '9px 13px', color: '#475569' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 13 }}>{sectionEmoji(b.seat?.section||'')}</span>
                                  {sec?.shortLabel||'—'}
                                </div>
                              </td>
                              <td style={{ padding: '9px 13px' }}>
                                {os && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: OS_META[os].bg, color: OS_META[os].color }}>{OS_META[os].label}</span>}
                              </td>
                              <td style={{ padding: '9px 13px', color: '#475569', whiteSpace: 'nowrap' }}>{new Date(b.booking_date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                              <td style={{ padding: '9px 13px', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.start_time.slice(0,5)}–{b.end_time.slice(0,5)}</td>
                              <td style={{ padding: '9px 13px', color: '#475569' }}>{mins>=60?`${Math.floor(mins/60)}h${mins%60>0?` ${mins%60}m`:''}`:`${mins}m`}{mins>600&&<Moon size={10} color="#7c3aed" style={{marginLeft:4}}/>}</td>
                              <td style={{ padding: '9px 13px' }}>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: b.status==='active'?'#dcfce7':'#f1f5f9', color: b.status==='active'?'#15803d':'#64748b' }}>{b.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
