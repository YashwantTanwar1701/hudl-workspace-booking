'use client'

import { useState, useEffect } from 'react'
import { Clock, Moon, Timer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ALL_TIME_SLOTS, NIGHT_SLOTS } from '../types'
import type { Shift } from '../types'
import { useTheme } from './ThemeProvider'

interface ShiftPickerProps {
  date: string                   // YYYY-MM-DD — needed to filter past shifts
  startTime: string
  endTime: string
  isOvernight: boolean
  onStartChange: (t: string) => void
  onEndChange: (t: string) => void
  onOvernightChange: (v: boolean) => void
  onShiftIdChange?: (id: number | null) => void
  validStartSlots?: string[]
  disabled?: boolean
  /** When true (default), shifts whose start time is < 30 min from now are
   *  hidden from the dropdown (booking-style restriction). When false, ALL
   *  shifts are shown regardless — used for view-only pages like the floor
   *  map / seat layout where the user just wants to see who's where. */
  restrictPastShifts?: boolean
}

function fmt(t: string) { return t.slice(0, 5) }

function minsBetween(a: string, b: string, overnight = false) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  let d = (bh * 60 + bm) - (ah * 60 + am)
  if (overnight || d <= 0) d += 1440
  return d
}

function fmtDur(mins: number) {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
}

/**
 * Sort order:
 * 1. Custom (handled separately)
 * 2. Morning Shift
 * 3. Afternoon Shift
 * 4. Night Shift
 * 5. General Shift
 * 6. Everything else sorted by start_time
 */
function sortShifts(shifts: Shift[]): Shift[] {
  const priority: Record<string, number> = {
    'morning shift': 1,
    'afternoon shift': 2,
    'night shift': 3,
    'general shift': 4,
  }
  return [...shifts].sort((a, b) => {
    const pa = priority[a.name.toLowerCase()] ?? 99
    const pb = priority[b.name.toLowerCase()] ?? 99
    if (pa !== pb) return pa - pb
    return a.start_time.localeCompare(b.start_time)
  })
}

/** Check if a shift's start time has already passed for today */
function isShiftAvailable(shift: Shift, date: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (date > today) return true   // future date — all shifts available
  if (date < today) return false  // past date — nothing available

  // Today: shift available only if start_time is at least 30 min from now
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = shift.start_time.split(':').map(Number)
  const shiftMins = sh * 60 + sm
  return shiftMins - nowMins >= 30
}

/** Returns true if "now" falls within this shift's time window (handles overnight shifts) */
function isShiftCurrentTime(shift: Shift): boolean {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = shift.start_time.split(':').map(Number)
  const [eh, em] = shift.end_time.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  if (endMins > startMins) {
    return nowMins >= startMins && nowMins < endMins
  }
  // overnight (e.g., 23:00 → 07:00): now is in the shift if past start OR before end
  return nowMins >= startMins || nowMins < endMins
}

export default function ShiftPicker({
  date, startTime, endTime, isOvernight,
  onStartChange, onEndChange, onOvernightChange, onShiftIdChange,
  validStartSlots, disabled = false, restrictPastShifts = true,
}: ShiftPickerProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [shifts, setShifts]               = useState<Shift[]>([])
  const [mode, setMode]                   = useState<'custom' | number>('custom')
  const [loading, setLoading]             = useState(true)

  useEffect(() => { fetchShifts() }, [])

  // When date changes, check if current shift is still available
  useEffect(() => {
    if (typeof mode === 'number' && restrictPastShifts) {
      const shift = shifts.find(s => s.id === mode)
      if (shift && !isShiftAvailable(shift, date)) {
        setMode('custom')
        onShiftIdChange?.(null)
      }
    }
  }, [date])

  async function fetchShifts() {
    const { data } = await supabase.from('shift').select('*').order('start_time')
    if (data && data.length > 0) {
      const sorted = sortShifts(data as Shift[])
      setShifts(sorted)

      // 1. If the current startTime/endTime exactly match a shift, lock to it
      const match = sorted.find(
        s => fmt(s.start_time) === startTime && fmt(s.end_time) === endTime
      )
      if (match) {
        setMode(match.id)
        setLoading(false)
        return
      }

      // 2. Otherwise, auto-select the shift whose time window contains "now"
      //    (only on initial load, only when looking at today's date)
      const today = new Date().toISOString().split('T')[0]
      if (date === today) {
        const current = sorted.find(s => isShiftCurrentTime(s))
        if (current) {
          setMode(current.id)
          const [sh, sm] = current.start_time.split(':').map(Number)
          const [eh, em] = current.end_time.split(':').map(Number)
          onOvernightChange((eh * 60 + em) <= (sh * 60 + sm))
          onStartChange(fmt(current.start_time))
          onEndChange(fmt(current.end_time))
          onShiftIdChange?.(current.id)
        }
      }
    }
    setLoading(false)
  }

  function selectMode(val: string) {
    if (val === 'custom') {
      setMode('custom')
      onShiftIdChange?.(null)
      return
    }
    const shiftId = parseInt(val)
    const shift = shifts.find(s => s.id === shiftId)
    if (!shift) return
    setMode(shiftId)
    // Detect overnight: shift crosses midnight when end_time <= start_time
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    const isNightShift = (eh * 60 + em) <= (sh * 60 + sm)
    onOvernightChange(isNightShift)
    onStartChange(fmt(shift.start_time))
    onEndChange(fmt(shift.end_time))
    onShiftIdChange?.(shiftId)
  }

  const isCustom = mode === 'custom'
  const selectedShift = typeof mode === 'number' ? shifts.find(s => s.id === mode) : null
  // When restrictPastShifts is true (booking flow), hide shifts whose start
  // is < 30 min from now. When false (view-only pages), show every shift so
  // users can browse Morning/Afternoon/Night even after each has started.
  const availableShifts = restrictPastShifts
    ? shifts.filter(s => isShiftAvailable(s, date))
    : shifts
  const dur = fmtDur(minsBetween(startTime, endTime, isOvernight))
  const effectiveStartSlots = validStartSlots ?? ALL_TIME_SLOTS
  const endSlots = isOvernight ? NIGHT_SLOTS : ALL_TIME_SLOTS.filter(t => t > startTime)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--muted-bg)', border: '1.5px solid var(--card-border)', borderRadius: 10 }}>
        <Clock size={12} color="#94a3b8" />
        <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>Loading shifts…</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>

      {/* ── Shift / Custom dropdown ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--muted-bg)', border: '1.5px solid var(--card-border)',
        borderRadius: 10, padding: '7px 12px',
      }}>
        <Clock size={12} color="#3b82f6" />
        <select
          value={isCustom ? 'custom' : String(mode)}
          onChange={e => selectMode(e.target.value)}
          disabled={disabled}
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--ink-700)',
            background: isDark ? 'var(--surface-2)' : 'transparent', border: 'none', outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            minWidth: 180,
            colorScheme: isDark ? 'dark' : 'light',
          }}
        >
          <option value="custom">Custom Time</option>
          {availableShifts.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}  ({fmt(s.start_time)} – {fmt(s.end_time)})
            </option>
          ))}
        </select>
      </div>

      {/* ── Info badge when a predefined shift is selected ── */}
      {!isCustom && selectedShift && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 10,
          background: '#f0f9ff', border: '1px solid #bae6fd',
          color: '#0369a1', fontSize: 12, fontWeight: 600,
        }}>
          <Timer size={12} />
          {fmt(selectedShift.start_time)} → {fmt(selectedShift.end_time)}
          <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
            ({fmtDur(minsBetween(fmt(selectedShift.start_time), fmt(selectedShift.end_time)))})
          </span>
        </div>
      )}

      {/* ── Custom time controls — visible only when "Custom Time" is selected ── */}
      {isCustom && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--muted-bg)', border: '1.5px solid var(--card-border)',
            borderRadius: 10, padding: '7px 12px',
          }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>From</span>
            <select
              value={startTime}
              onChange={e => onStartChange(e.target.value)}
              disabled={disabled || effectiveStartSlots.length === 0}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', background: isDark ? 'var(--surface-2)' : 'transparent', border: 'none', outline: 'none', cursor: 'pointer', colorScheme: isDark ? 'dark' : 'light' }}
            >
              {effectiveStartSlots.length === 0
                ? <option>No slots</option>
                : effectiveStartSlots.map(t => <option key={t} value={t}>{t}</option>)
              }
            </select>
            <span style={{ color: '#cbd5e1', fontSize: 11 }}>→</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>To</span>
            <select
              value={endTime}
              onChange={e => onEndChange(e.target.value)}
              disabled={disabled}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', background: isDark ? 'var(--surface-2)' : 'transparent', border: 'none', outline: 'none', cursor: 'pointer', colorScheme: isDark ? 'dark' : 'light' }}
            >
              {endSlots.map(t => (
                <option key={t} value={t}>{t}{isOvernight ? ' (+1 day)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Night shift toggle */}
          <button
            onClick={() => onOvernightChange(!isOvernight)}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 10,
              border: `1.5px solid ${isOvernight ? '#7c3aed' : '#e2e8f0'}`,
              background: isOvernight ? '#ede9fe' : '#f8fafc',
              color: isOvernight ? '#7c3aed' : '#64748b',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: isOvernight ? 700 : 500,
              fontFamily: 'inherit',
            }}
          >
            <Moon size={12} /> Night Shift
          </button>

          {/* Duration badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '7px 12px', borderRadius: 10,
            background: '#f0f9ff', border: '1px solid #bae6fd',
            color: '#0369a1', fontSize: 12, fontWeight: 600,
          }}>
            <Timer size={12} /> {dur}
          </div>
        </>
      )}
    </div>
  )
}
