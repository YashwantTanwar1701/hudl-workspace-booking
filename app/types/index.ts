export type OsType = 'mac' | 'windows' | 'other'
export type BookingStatus = 'active' | 'cancelled'
export type UserRole = 'admin' | 'user'

export interface Seat {
  id: string
  seat_number: string
  floor: string | null
  section: string | null
  os_type: OsType
  has_machine: boolean
  is_active: boolean
  is_locked: boolean
  machine_number: number | null
  created_at: string
}

export interface Booking {
  id: string
  user_id: string
  seat_id: string
  booking_date: string
  start_time: string
  end_time: string
  start_ts: string
  end_ts: string
  status: BookingStatus
  created_at: string
  seat?: Seat
  user?: UserProfile
  is_overnight?: boolean
  end_date?: string
}

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  created_at: string
}

export const FLOOR_SECTIONS = [
  { id: 'server-room-lane',   label: 'Server Room Lane',        shortLabel: 'Server Lane',  description: '144 workstations',                 color: '#EDE7F6', accent: '#7B1FA2', capacity: 144 },
  { id: 'town-hall-lane',     label: 'Town Hall Lane',          shortLabel: 'TH Lane',      description: '140 workstations',                 color: '#E3F2FD', accent: '#1565C0', capacity: 140 },
  { id: 'hr-it-lane',         label: 'HR/IT Room Lane',         shortLabel: 'HR/IT Lane',   description: '122 workstations',                 color: '#E8F5E9', accent: '#2E7D32', capacity: 122 },
  { id: 'hr-ops-it',          label: 'HR/OPS/IT Room',          shortLabel: 'HR/OPS/IT',    description: '10 seats',                         color: '#F3E5F5', accent: '#9C27B0', capacity: 10  },
  { id: 'phone-booth-2s-1',   label: '2 Seater Phone Booth 1',  shortLabel: 'Booth 2S-1',   description: '2 seats · No system',              color: '#F1F8E9', accent: '#558B2F', capacity: 2   },
  { id: 'phone-booth-2s-2',   label: '2 Seater Phone Booth 2',  shortLabel: 'Booth 2S-2',   description: '2 seats · No system',              color: '#F1F8E9', accent: '#558B2F', capacity: 2   },
  { id: 'phone-booth-2s-3',   label: '2 Seater Phone Booth 3',  shortLabel: 'Booth 2S-3',   description: '2 seats · No system',              color: '#F1F8E9', accent: '#558B2F', capacity: 2   },
  { id: 'training-room-1',    label: 'Training Room 1',         shortLabel: 'Training 1',   description: '20 seats',                         color: '#FFF8E1', accent: '#FF9800', capacity: 20  },
  { id: 'training-room-2',    label: 'Training Room 2',         shortLabel: 'Training 2',   description: '24 seats',                         color: '#FFF3E0', accent: '#FF5722', capacity: 24  },
  { id: 'training-room-3',    label: 'Training Room 3',         shortLabel: 'Training 3',   description: '24 seats',                         color: '#FBE9E7', accent: '#BF360C', capacity: 24  },
  { id: 'phone-booth-1s-1',   label: 'Phone Booth 1',           shortLabel: 'Booth 1',      description: '1 seat · No system',               color: '#E8F5E9', accent: '#388E3C', capacity: 1   },
  { id: 'phone-booth-1s-2',   label: 'Phone Booth 2',           shortLabel: 'Booth 2',      description: '1 seat · No system',               color: '#E8F5E9', accent: '#388E3C', capacity: 1   },
  { id: 'phone-booth-1s-3',   label: 'Phone Booth 3',           shortLabel: 'Booth 3',      description: '1 seat · No system',               color: '#E8F5E9', accent: '#388E3C', capacity: 1   },
  { id: 'wellness-room',      label: 'Wellness Room',           shortLabel: 'Wellness',     description: '1 room · Relaxation space',         color: '#FCE4EC', accent: '#E91E63', capacity: 1   },
  { id: 'conference-12pax',   label: '12 PAX Conference Room',  shortLabel: 'Conf 12',      description: '12 seats · No system',              color: '#E8EAF6', accent: '#3F51B5', capacity: 12  },
  { id: 'meeting-4pax-1',     label: '4 PAX Meeting Room 1',    shortLabel: 'Mtg 4-1',      description: '4 seats · No system',              color: '#FCE4EC', accent: '#C62828', capacity: 4   },
  { id: 'meeting-4pax-2',     label: '4 PAX Meeting Room 2',    shortLabel: 'Mtg 4-2',      description: '4 seats · No system',              color: '#FBE9E7', accent: '#FF7043', capacity: 4   },
  { id: 'meeting-4pax-3',     label: '4 PAX Meeting Room 3',    shortLabel: 'Mtg 4-3',      description: '4 seats · No system',              color: '#FFF3E0', accent: '#FF9800', capacity: 4   },
  { id: 'product-team',       label: 'Product Team Room',       shortLabel: 'Product',      description: '8 seats',                          color: '#E8F5E9', accent: '#4CAF50', capacity: 8   },
  { id: 'cafeteria-zone',     label: 'Cafeteria Zone',          shortLabel: 'Cafeteria',    description: '90 seats · Dining & casual',        color: '#FBE9E7', accent: '#795548', capacity: 90  },
] as const

export type SectionId = typeof FLOOR_SECTIONS[number]['id']

export const OS_META = {
  mac:          { label: 'macOS',      color: '#1d4ed8', bg: '#dbeafe', symbol: '' },
  windows:      { label: 'Windows',    color: '#15803d', bg: '#dcfce7', symbol: '⊞' },
  'other':       { label: 'Seat Only',  color: '#92400e', bg: '#fef3c7', symbol: '🪑' },
} as const

export const ALL_TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export const TIME_SLOTS = ALL_TIME_SLOTS
export const NIGHT_SLOTS = ALL_TIME_SLOTS.filter(t => t <= '07:30')

/** Round current time up to next 30-min slot */
export function getCurrentTimeSlot(): string {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  if (m === 0)  return `${String(h).padStart(2,'0')}:00`
  if (m <= 30)  return `${String(h).padStart(2,'0')}:30`
  const nh = (h + 1) % 24
  return `${String(nh).padStart(2,'0')}:00`
}

/** Default end = start + 1h */
export function getDefaultEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + 60
  const eh = Math.floor(total / 60) % 24
  const em = total % 60 === 0 ? '00' : '30'
  return `${String(eh).padStart(2,'0')}:${em}`
}

export function getValidStartSlots(selectedDate: string): string[] {
  const today = new Date().toISOString().split('T')[0]
  if (selectedDate > today) return ALL_TIME_SLOTS.filter(t => t >= '06:00')
  if (selectedDate === today) {
    const now = new Date()
    const cutoff = now.getHours() * 60 + now.getMinutes() + 30
    return ALL_TIME_SLOTS.filter(t => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m >= cutoff && t >= '06:00'
    })
  }
  return []
}
