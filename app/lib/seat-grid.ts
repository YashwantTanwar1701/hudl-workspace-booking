/**
 * Shared spec for the row × column seat grid used by the Seat Layout page
 * and the Book page. Single source of truth — edit here to update both.
 */

export type LaneGroup = 'top-left' | 'top-hr' | 'top-th' | 'cafeteria' | 'training' | 'rooms' | 'booth'

export type LaneSpec = {
  id: string
  prefix: string
  title: string
  subtitle: string
  icon: string                     // emoji OR raw SVG markup string
  iconIsSvg?: boolean
  sectionId: string                // kept for reference / legacy
  roomId?: number                  // DB room.id — primary matching key
  cols: number
  colsRows: number[]
  readFromBottom: boolean
  bgColor: string      // light mode card header background
  darkBgColor: string  // dark mode card header background
  accentColor: string
  excludeCells?: { col: number; row: number }[]
  colGaps?: number[]
  rowGaps?: number[]
  group: LaneGroup
}

const SERVER_ROWS = Array(6).fill(24)

const TH_ROWS: number[] = (() => {
  const arr: number[] = []
  for (let c = 1; c <= 20; c++) {
    if (c === 1) arr.push(7)
    else if ([2, 3, 4, 15, 16, 17, 18, 19, 20].includes(c)) arr.push(8)
    else if ([5, 6].includes(c)) arr.push(7)
    else arr.push(6)
  }
  return arr
})()

const HR_ROWS: number[] = (() => {
  const arr: number[] = []
  for (let c = 1; c <= 20; c++) {
    if ([1, 2, 3, 4, 15, 16, 17, 18, 19, 20].includes(c)) arr.push(7)
    else if ([5, 6].includes(c)) arr.push(6)
    else arr.push(5)
  }
  return arr
})()

export const WELLNESS_BED_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>'

/**
 * Lanes ordered as they appear on the page. Wellness Room is intentionally
 * the LAST entry in the 'rooms' group so it appears at the end on the Book
 * page list (emergency-only access).
 */
export const LANES: LaneSpec[] = [
  /* ── Top L-section ── */
  {
    id: 'server',
    prefix: 'SRL',
    title: 'Server Room Lane',
    subtitle: '6 columns × 24 rows · 144 seats · paired rows',
    icon: '🖥️',
    sectionId: 'server-room-lane',
    roomId: 1,
    cols: 6,
    colsRows: SERVER_ROWS,
    readFromBottom: false,
    rowGaps: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
    bgColor: '#EDE7F6',
    darkBgColor: '#1a1227',
    accentColor: '#7B1FA2',
    group: 'top-left',
  },
  {
    id: 'hr',
    prefix: 'HRL',
    title: 'HR / OPS Lane',
    subtitle: '20 columns · variable rows · 122 seats · 2-col bands',
    icon: '💼',
    sectionId: 'hr-it-lane',
    roomId: 3,
    cols: 20,
    colsRows: HR_ROWS,
    readFromBottom: false,
    colGaps: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    bgColor: '#E8F5E9',
    darkBgColor: '#0f1a11',
    accentColor: '#2E7D32',
    group: 'top-hr',
  },
  {
    id: 'th',
    prefix: 'THL',
    title: 'Town Hall Lane',
    subtitle: '20 columns · variable rows (read bottom-up) · 141 seats · 2-col bands',
    icon: '🏢',
    sectionId: 'town-hall-lane',
    roomId: 2,
    cols: 20,
    colsRows: TH_ROWS,
    readFromBottom: true,
    colGaps: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    bgColor: '#E3F2FD',
    darkBgColor: '#0c1929',
    accentColor: '#1565C0',
    group: 'top-th',
  },
  /* ── Cafeteria full width ── */
  {
    id: 'cafeteria',
    prefix: 'CAF',
    title: 'Cafeteria Zone',
    subtitle: '10 columns × 10 rows · Col 5 R2/R3 missing · 98 seats',
    icon: '☕',
    sectionId: 'cafeteria-zone',
    roomId: 20,
    cols: 10,
    colsRows: Array(10).fill(10),
    readFromBottom: false,
    excludeCells: [
      { col: 5, row: 3 },
      { col: 5, row: 4 },
    ],
    colGaps: [4],
    rowGaps: [2, 4, 6, 8],
    bgColor: '#FBE9E7',
    darkBgColor: '#1c100e',
    accentColor: '#795548',
    group: 'cafeteria',
  },
  /* ── Training rooms grouped ── */
  {
    id: 'training1',
    prefix: 'TR1',
    title: 'Training Room 1',
    subtitle: '4 columns × 5 rows · 20 seats',
    icon: '📚',
    sectionId: 'training-room-1',
    roomId: 8,
    cols: 4,
    colsRows: Array(4).fill(5),
    readFromBottom: false,
    colGaps: [1, 3],
    bgColor: '#FFF8E1',
    darkBgColor: '#1a1508',
    accentColor: '#FF9800',
    group: 'training',
  },
  {
    id: 'training2',
    prefix: 'TR2',
    title: 'Training Room 2',
    subtitle: '6 columns × 4 rows · 24 seats',
    icon: '📚',
    sectionId: 'training-room-2',
    roomId: 9,
    cols: 6,
    colsRows: Array(6).fill(4),
    readFromBottom: false,
    rowGaps: [1, 3],
    colGaps: [3],
    bgColor: '#FFF3E0',
    darkBgColor: '#1a1208',
    accentColor: '#FF5722',
    group: 'training',
  },
  {
    id: 'training3',
    prefix: 'TR3',
    title: 'Training Room 3',
    subtitle: '6 columns × 4 rows · 24 seats',
    icon: '📚',
    sectionId: 'training-room-3',
    roomId: 10,
    cols: 6,
    colsRows: Array(6).fill(4),
    readFromBottom: false,
    rowGaps: [1, 3],
    colGaps: [3],
    bgColor: '#FBE9E7',
    darkBgColor: '#1c100e',
    accentColor: '#BF360C',
    group: 'training',
  },
  /* ── Other Rooms ── */
  {
    id: 'product',
    prefix: 'PT',
    title: 'Product Team Room',
    subtitle: '5 cols · bottom-row 5 + top-row 3 (Cols 3-5) · 8 seats',
    icon: '🚀',
    sectionId: 'product-team',
    roomId: 19,
    cols: 5,
    colsRows: [1, 1, 2, 2, 2],
    readFromBottom: true,
    rowGaps: [1],
    bgColor: '#E8F5E9',
    darkBgColor: '#0f1a11',
    accentColor: '#4CAF50',
    group: 'rooms',
  },
  {
    id: 'conf12',
    prefix: 'C12',
    title: '12 PAX Conference Room',
    subtitle: '3 cols × 7 rows · Col 2 only R1+R7, Cols 1&3 only R2-R6 · 12 seats',
    icon: '🏛️',
    sectionId: 'conference-12pax',
    roomId: 15,
    cols: 3,
    colsRows: [7, 7, 7],
    readFromBottom: false,
    excludeCells: [
      { col: 1, row: 1 }, { col: 1, row: 7 },
      { col: 2, row: 2 }, { col: 2, row: 3 }, { col: 2, row: 4 }, { col: 2, row: 5 }, { col: 2, row: 6 },
      { col: 3, row: 1 }, { col: 3, row: 7 },
    ],
    bgColor: '#E8EAF6',
    darkBgColor: '#0f1020',
    accentColor: '#3F51B5',
    group: 'rooms',
  },
  {
    id: 'hritroom',
    prefix: 'HRR',
    title: 'HR / IT Room',
    subtitle: '3 cols · Cols 1-2 = 3 rows, Col 3 = 4 rows · 10 seats',
    icon: '⚙️',
    sectionId: 'hr-ops-it',
    roomId: 4,
    cols: 3,
    colsRows: [3, 3, 4],
    readFromBottom: false,
    colGaps: [2],
    bgColor: '#F3E5F5',
    darkBgColor: '#180f1c',
    accentColor: '#9C27B0',
    group: 'rooms',
  },
  /* ── Meeting rooms ── */
  {
    id: 'mtg4_1',
    prefix: 'M4A',
    title: '4 PAX Meeting Room - 1',
    subtitle: '2 cols × 2 rows · 4 seats',
    icon: '🤝',
    sectionId: 'meeting-4pax-1',
    roomId: 16,
    cols: 2,
    colsRows: [2, 2],
    readFromBottom: false,
    bgColor: '#FCE4EC',
    darkBgColor: '#1c0d14',
    accentColor: '#C62828',
    group: 'booth',
  },
  {
    id: 'mtg4_2',
    prefix: 'M4B',
    title: '4 PAX Meeting Room - 2',
    subtitle: '2 cols × 2 rows · 4 seats',
    icon: '🤝',
    sectionId: 'meeting-4pax-2',
    roomId: 17,
    cols: 2,
    colsRows: [2, 2],
    readFromBottom: false,
    bgColor: '#FBE9E7',
    darkBgColor: '#1c100e',
    accentColor: '#FF7043',
    group: 'booth',
  },
  /* ── Phone booths ── */
  {
    id: 'booth2_1',
    prefix: 'B2A',
    title: '2 PAX Phone Booth - 1',
    subtitle: '2 cols × 1 row · 2 seats',
    icon: '📟',
    sectionId: 'phone-booth-2s-1',
    roomId: 5,
    cols: 2,
    colsRows: [1, 1],
    readFromBottom: false,
    bgColor: '#F1F8E9',
    darkBgColor: '#0f180a',
    accentColor: '#558B2F',
    group: 'booth',
  },
  {
    id: 'booth2_2',
    prefix: 'B2B',
    title: '2 PAX Phone Booth - 2',
    subtitle: '2 cols × 1 row · 2 seats',
    icon: '📟',
    sectionId: 'phone-booth-2s-2',
    roomId: 6,
    cols: 2,
    colsRows: [1, 1],
    readFromBottom: false,
    bgColor: '#F1F8E9',
    darkBgColor: '#0f180a',
    accentColor: '#558B2F',
    group: 'booth',
  },
  {
    id: 'booth2_3',
    prefix: 'B2C',
    title: '2 PAX Phone Booth - 3',
    subtitle: '2 cols × 1 row · 2 seats',
    icon: '📟',
    sectionId: 'phone-booth-2s-3',
    roomId: 7,
    cols: 2,
    colsRows: [1, 1],
    readFromBottom: false,
    bgColor: '#F1F8E9',
    darkBgColor: '#0f180a',
    accentColor: '#558B2F',
    group: 'booth',
  },
  {
    id: 'booth1_1',
    prefix: 'B1A',
    title: '1 PAX Phone Booth - 1',
    subtitle: '1 col × 1 row · 1 seat',
    icon: '📞',
    sectionId: 'phone-booth-1s-1',
    roomId: 11,
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#E8F5E9',
    darkBgColor: '#0f1a11',
    accentColor: '#388E3C',
    group: 'booth',
  },
  {
    id: 'booth1_2',
    prefix: 'B1B',
    title: '1 PAX Phone Booth - 2',
    subtitle: '1 col × 1 row · 1 seat',
    icon: '📞',
    sectionId: 'phone-booth-1s-2',
    roomId: 12,
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#E8F5E9',
    darkBgColor: '#0f1a11',
    accentColor: '#388E3C',
    group: 'booth',
  },
  {
    id: 'booth1_3',
    prefix: 'B1C',
    title: '1 PAX Phone Booth - 3',
    subtitle: '1 col × 1 row · 1 seat',
    icon: '📞',
    sectionId: 'phone-booth-1s-3',
    roomId: 13,
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#E8F5E9',
    darkBgColor: '#0f1a11',
    accentColor: '#388E3C',
    group: 'booth',
  },
  /* ── Wellness LAST (emergency-only access on Book page) ── */
  {
    id: 'wellness',
    prefix: 'WEL',
    title: 'Wellness Room',
    subtitle: '1 seat · Relaxation space · Emergency only',
    icon: WELLNESS_BED_SVG,
    iconIsSvg: true,
    sectionId: 'wellness-room',
    roomId: 14,
    cols: 1,
    colsRows: [1],
    readFromBottom: false,
    bgColor: '#FCE4EC',
    darkBgColor: '#1c0d14',
    accentColor: '#E91E63',
    group: 'rooms',
  },
  /* ── Open Meeting Pod ── */
  {
    id: 'open_pod',
    prefix: 'OMP',
    title: 'Open Meeting Pod',
    subtitle: '6 seats · 1 row · 2-seat bands',
    icon: '🪑',
    sectionId: 'open-meeting-pod',
    roomId: 21,
    cols: 6,
    colsRows: [1, 1, 1, 1, 1, 1],
    readFromBottom: false,
    colGaps: [2, 4],       // gaps after C2 and C4 → three bands of 2
    bgColor: '#E0F2F1',
    darkBgColor: '#0a1f1e',
    accentColor: '#00796B',
    group: 'booth',
  },
]

export const BIG_GROUPS: LaneGroup[] = ['top-left', 'top-hr', 'top-th', 'cafeteria']

/* ───────── Cell descriptor ───────── */
export type LaneCell =
  | { kind: 'seat'; col: number; row: number; visualRow: number; cellId: string; dbSeatIndex: number }
  | { kind: 'empty'; col: number; visualRow: number }
  | { kind: 'col-header'; col: number }
  | { kind: 'row-header'; visualRow: number; row: number }
  | { kind: 'corner' }

/**
 * Build the static grid layout for a lane.
 *
 * Returns the cells AND the seat-index mapping. For each spec-cell that
 * holds a seat, we record its 0-based position in the lane's seat sequence
 * (top-down, left-to-right by visualRow then col).
 *
 * Callers pair these with their actual DB seats by index — i.e. dbSeats[0]
 * goes into the cell with dbSeatIndex=0, etc.
 */
export function buildLaneCells(lane: LaneSpec): { cells: LaneCell[]; maxRows: number; seatCount: number } {
  const maxRows = Math.max(...lane.colsRows)
  const cells: LaneCell[] = []
  const excludedKey = (col: number, row: number) => `${col}:${row}`
  const excluded = new Set(
    (lane.excludeCells || []).map(c => excludedKey(c.col, c.row))
  )

  cells.push({ kind: 'corner' })

  for (let c = 1; c <= lane.cols; c++) {
    cells.push({ kind: 'col-header', col: c })
  }

  let seatIndex = 0
  for (let visualRow = 1; visualRow <= maxRows; visualRow++) {
    const logicalRow = lane.readFromBottom ? maxRows - visualRow + 1 : visualRow
    cells.push({ kind: 'row-header', visualRow, row: logicalRow })
    for (let c = 1; c <= lane.cols; c++) {
      const rowsInCol = lane.colsRows[c - 1]
      const inHeight = logicalRow <= rowsInCol
      const notExcluded = !excluded.has(excludedKey(c, logicalRow))
      const hasSeat = inHeight && notExcluded
      if (hasSeat) {
        const cellId = `${lane.prefix}-C${c}R${logicalRow}`
        cells.push({ kind: 'seat', col: c, row: logicalRow, visualRow, cellId, dbSeatIndex: seatIndex })
        seatIndex++
      } else {
        cells.push({ kind: 'empty', col: c, visualRow })
      }
    }
  }

  return { cells, maxRows, seatCount: seatIndex }
}

/** True if this lane id is the Wellness Room. */
export function isWellnessLane(laneId: string): boolean {
  return laneId === 'wellness'
}

/**
 * Get the display name for a lane, preferring the DB room name over the hardcoded title.
 * Pass the roomNames map built from: { [room.id]: room.name }
 */
export function getLaneName(lane: LaneSpec, roomNames: Record<number, string>): string {
  if (lane.roomId != null && roomNames[lane.roomId]) return roomNames[lane.roomId]
  return lane.title
}
