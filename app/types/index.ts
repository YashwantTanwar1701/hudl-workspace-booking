export type OsType = 'mac' | 'windows' | 'other'
export type BookingStatus = 'active' | 'cancelled'
export type UserRole = 'admin' | 'user'

/* ─── Room (from DB table `rooms`) ─── */
export interface Room {
  id: number
  created_at: string
  name: string
  capacity: number
  status: boolean
}

/* ─── Seat (from DB table `seats`, now includes room_id) ─── */
export interface Seat {
  id: string
  seat_number: string
  floor: string | null
  section: string | null      // legacy slug, e.g. 'server-room-lane'
  os_type: OsType
  has_machine: boolean
  is_active: boolean
  notes: string | null
  machine_number: number | null
  created_at: string
  room_id: number | null      // FK → rooms.id
  room?: Room                 // populated via join
}


/* ─── Shift (from DB table `shift`) ─── */
export interface Shift {
  id: number
  name: string
  start_time: string   // HH:MM:SS
  end_time: string     // HH:MM:SS
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
  notes: string | null
  created_at: string
  shift_id: number | null
  seat?: Seat
  user?: UserProfile
  shift?: Shift
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

/*
 * FLOOR_SECTIONS — static metadata for UI rendering (colors, emoji, shortLabels).
 * The `label` here is a FALLBACK; the authoritative room name comes from DB `rooms.name`.
 * The `id` (section slug) matches seats.section in the DB.
 * The `roomId` links to rooms.id.
 */
export const FLOOR_SECTIONS = [
  { id: 'server-room-lane',   roomId: 1,  label: 'Server Room Lane',              shortLabel: 'Server Lane',  description: '144 workstations',            color: '#EDE7F6', accent: '#7B1FA2', capacity: 144 },
  { id: 'town-hall-lane',     roomId: 2,  label: 'Town Hall Lane',                shortLabel: 'TH Lane',      description: '140 workstations',            color: '#E3F2FD', accent: '#1565C0', capacity: 140 },
  { id: 'hr-it-lane',         roomId: 3,  label: 'HR/IT Room Lane',               shortLabel: 'HR/IT Lane',   description: '122 workstations',            color: '#E8F5E9', accent: '#2E7D32', capacity: 122 },
  { id: 'hr-ops-it',          roomId: 4,  label: 'HR/OPS/IT Room',                shortLabel: 'HR/OPS/IT',    description: '10 seats',                    color: '#F3E5F5', accent: '#9C27B0', capacity: 10  },
  { id: 'phone-booth-2s-1',   roomId: 5,  label: '2 Seater - Phone Booth 1',      shortLabel: 'Booth 2S-1',   description: '2 seats · No system',         color: '#F1F8E9', accent: '#558B2F', capacity: 2   },
  { id: 'phone-booth-2s-2',   roomId: 6,  label: '2 Seater - Phone Booth 2',      shortLabel: 'Booth 2S-2',   description: '2 seats · No system',         color: '#F1F8E9', accent: '#558B2F', capacity: 2   },
  { id: 'phone-booth-2s-3',   roomId: 7,  label: '2 Seater - Phone Booth 3',      shortLabel: 'Booth 2S-3',   description: '2 seats · No system',         color: '#F1F8E9', accent: '#558B2F', capacity: 2   },
  { id: 'training-room-1',    roomId: 8,  label: 'Training Room 1',               shortLabel: 'Training 1',   description: '20 seats',                    color: '#FFF8E1', accent: '#FF9800', capacity: 20  },
  { id: 'training-room-2',    roomId: 9,  label: 'Training Room 2',               shortLabel: 'Training 2',   description: '24 seats',                    color: '#FFF3E0', accent: '#FF5722', capacity: 24  },
  { id: 'training-room-3',    roomId: 10, label: 'Training Room 3',               shortLabel: 'Training 3',   description: '24 seats',                    color: '#FBE9E7', accent: '#BF360C', capacity: 24  },
  { id: 'phone-booth-1s-1',   roomId: 11, label: 'Phone Booth 1',                 shortLabel: 'Booth 1',      description: '1 seat · No system',          color: '#E8F5E9', accent: '#388E3C', capacity: 1   },
  { id: 'phone-booth-1s-2',   roomId: 12, label: 'Phone Booth 2',                 shortLabel: 'Booth 2',      description: '1 seat · No system',          color: '#E8F5E9', accent: '#388E3C', capacity: 1   },
  { id: 'phone-booth-1s-3',   roomId: 13, label: 'Phone Booth 3',                 shortLabel: 'Booth 3',      description: '1 seat · No system',          color: '#E8F5E9', accent: '#388E3C', capacity: 1   },
  { id: 'wellness-room',      roomId: 14, label: 'Wellness Room',                 shortLabel: 'Wellness',     description: '1 room · Relaxation space',   color: '#FCE4EC', accent: '#E91E63', capacity: 1   },
  { id: 'conference-12pax',   roomId: 15, label: '12 PAX Conference Room',        shortLabel: 'Conf 12',      description: '12 seats · No system',        color: '#E8EAF6', accent: '#3F51B5', capacity: 12  },
  { id: 'meeting-4pax-1',     roomId: 16, label: '4 PAX Meeting Room - 1',        shortLabel: 'Mtg 4-1',      description: '4 seats · No system',         color: '#FCE4EC', accent: '#C62828', capacity: 4   },
  { id: 'meeting-4pax-2',     roomId: 17, label: '4 PAX Meeting Room - 2',        shortLabel: 'Mtg 4-2',      description: '4 seats · No system',         color: '#FBE9E7', accent: '#FF7043', capacity: 4   },
  { id: 'meeting-4pax-3',     roomId: 18, label: '4 PAX Meeting Room - 3',        shortLabel: 'Mtg 4-3',      description: '4 seats · No system',         color: '#FFF3E0', accent: '#FF9800', capacity: 4   },
  { id: 'product-team',       roomId: 19, label: 'Product Team Room',             shortLabel: 'Product',      description: '8 seats',                     color: '#E8F5E9', accent: '#4CAF50', capacity: 8   },
  { id: 'cafeteria-zone',     roomId: 20, label: 'Cafeteria Zone',                shortLabel: 'Cafeteria',    description: '90 seats · Dining & casual',  color: '#FBE9E7', accent: '#795548', capacity: 90  },
] as const

export type SectionId = typeof FLOOR_SECTIONS[number]['id']

/**
 * Look up UI metadata for a section/room.
 * Tries room_id first, then falls back to section slug.
 */
export function getSectionMeta(seat: Seat): typeof FLOOR_SECTIONS[number] | undefined {
  if (seat.room_id != null) {
    return FLOOR_SECTIONS.find(s => s.roomId === seat.room_id)
  }
  return FLOOR_SECTIONS.find(s => s.id === seat.section)
}

/**
 * Get the display name for a room.
 * Priority: seat.room.name (DB) → FLOOR_SECTIONS label → section slug
 */
export function getRoomName(seat: Seat): string {
  if (seat.room?.name) return seat.room.name
  const meta = getSectionMeta(seat)
  if (meta) return meta.label
  return seat.section ?? 'Unknown'
}


/** Build a lookup map from room_id → Room. Use with rooms fetched from DB. */
export type RoomMap = Record<number, Room>

export function buildRoomMap(rooms: Room[]): RoomMap {
  const map: RoomMap = {}
  rooms.forEach(r => { map[r.id] = r })
  return map
}

/** Get room name from a seat using a room map. Falls back to FLOOR_SECTIONS then section slug. */
export function roomNameFromMap(seat: Seat, roomMap: RoomMap): string {
  if (seat.room_id != null && roomMap[seat.room_id]) return roomMap[seat.room_id].name
  const meta = getSectionMeta(seat)
  if (meta) return meta.label
  return seat.section ?? 'Unknown'
}

export const OS_META = {
  mac:     { label: 'macOS',     color: '#1d4ed8', bg: '#dbeafe', symbol: '' },
  windows: { label: 'Windows',   color: '#15803d', bg: '#dcfce7', symbol: '⊞' },
  other:   { label: 'Seat Only', color: '#92400e', bg: '#fef3c7', symbol: '🪑' },
} as const

export const ALL_TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export const TIME_SLOTS = ALL_TIME_SLOTS
export const NIGHT_SLOTS = ALL_TIME_SLOTS.filter(t => t <= '07:30')

export function getCurrentTimeSlot(): string {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  if (m === 0)  return `${String(h).padStart(2,'0')}:00`
  if (m <= 30)  return `${String(h).padStart(2,'0')}:30`
  const nh = (h + 1) % 24
  return `${String(nh).padStart(2,'0')}:00`
}

export function getDefaultEndTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + 60
  const eh = Math.floor(total / 60) % 24
  const em = total % 60 === 0 ? '00' : '30'
  return `${String(eh).padStart(2,'0')}:${em}`
}

export function getValidStartSlots(selectedDate: string): string[] {
  const today = new Date().toLocaleDateString('en-CA')
  // Future date: all 30-min slots available (full 24h)
  if (selectedDate > today) return ALL_TIME_SLOTS
  // Today: only slots at least 30 min from now (no 6AM floor)
  if (selectedDate === today) {
    const now = new Date()
    const cutoff = now.getHours() * 60 + now.getMinutes() + 30
    return ALL_TIME_SLOTS.filter(t => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m >= cutoff
    })
  }
  // Past date: nothing
  return []
}
