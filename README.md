# WorkSpace — Seat Booking System

A production-ready **Next.js 14** office seat booking app powered by **Supabase**.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres, Auth, RLS)
- **Tailwind CSS** + custom CSS variables (white theme)
- **Fonts**: Playfair Display (headings) + Outfit (body) + Geist Mono (seats)

---

## Features

### Floor Map (Homepage `/`)
- 🗺️ **SVG Blueprint** — Interactive floor map matching the actual office blueprint with all sections labelled
- 🔴🟡🟢 **Live utilization dots** — Per-section availability color-coding on the map
- 📍 **Quick Jump pills** — Click any section pill to highlight it and scroll to it
- 💻 **OS type badges** — Mac, Windows, Linux icons per section (pulled from DB)
- 📊 **Seat mini-grids** — See individual seat availability at a glance per section

### Book a Seat (`/book`)
- 📅 **Date + time range picker** — 30-minute slots 8am–8pm
- 🏢 **Section filter** — All 17 blueprint sections
- 💻 **OS preference filter** — Mac / Windows / Other
- 🪑 **Visual seat grid** — Per section, showing available/booked/my booking/selected states
- ⚡ **Real-time conflict check** — Overlap protected by GiST exclusion constraint

### My Bookings (`/my-bookings`)
- 📋 **Upcoming / Past / All** tabs
- 🚫 **Cancel** active bookings
- 📊 Stats panel

### Admin Dashboard (`/admin`) — admin role only
- 📊 Overview with section utilization bars
- 🪑 Seat CRUD (add, edit, disable, delete) — including OS type, section, machine number
- 📅 All bookings with cancel
- 👥 User list
- ✉️ Invite via magic link

### Auth (`/auth`)
- ✉️ Magic link (OTP)
- 🔑 Email + password
- Split-screen branded layout

---

## Blueprint Sections (all 17 from floor plan)

| Section | Description |
|---------|-------------|
| Reception Area | Main entrance |
| HR / OPS / IT Office | Administration |
| Product Team Room | Engineering hub |
| Training Room 1, 2, 3 | 24-seater each |
| Meeting Room 4 PAX (A & B) | Small meeting |
| Meeting Room 12 PAX (A & B) | Large meeting |
| Town Hall | AV presentations |
| 100 PAX Cafeteria | Dining area |
| Open Breakout Area | Informal collaboration |
| Phone Booth 1 Seater (A & B) | Private calls |
| Phone Booth 2 Seater | 2-person calls |
| Open Meeting Pod | Collaborative pod |

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run the SQL schema

Run the provided SQL in Supabase SQL editor to create tables, enums, RLS policies, and triggers.

### 4. Run dev server

```bash
npm run dev
```

### 5. Make yourself admin

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@company.com';
```

### 6. Add seats

Go to **Admin → Seats** to add seats with:
- Seat number (e.g. `PT-01`)
- Section (from dropdown matching blueprint)
- OS type (Mac / Windows / Other)
- Machine number (optional)

Or use SQL bulk insert:

```sql
INSERT INTO seats (seat_number, floor, section, os_type, has_machine, is_active)
VALUES
  ('PT-01', '3', 'product-team', 'mac', true, true),
  ('PT-02', '3', 'product-team', 'windows', true, true),
  ('HR-01', '3', 'hr-ops-it', 'windows', true, true),
  -- ... etc
```

---

## Section IDs (for DB)

Use these exact strings in the `section` column:

```
reception, hr-ops-it, product-team, training-room-1, training-room-2,
training-room-3, meeting-4pax-a, meeting-4pax-b, meeting-12pax-a,
meeting-12pax-b, town-hall, cafeteria, open-breakout, phone-booth-1a,
phone-booth-1b, phone-booth-2s, open-meeting-pod
```

---

## Project Structure

```
app/
├── layout.tsx              # Root layout with Navbar
├── page.tsx                # Floor map homepage
├── globals.css             # Design tokens + animations
├── auth/page.tsx           # Sign-in
├── book/page.tsx           # Booking flow
├── my-bookings/page.tsx    # User's bookings
├── admin/page.tsx          # Admin dashboard
├── components/
│   ├── AuthProvider.tsx    # Supabase auth context
│   ├── Navbar.tsx          # Navigation
│   └── OsBadge.tsx         # OS icon + badge components
├── lib/supabase.ts         # Supabase client
└── types/index.ts          # Types + all section config
```
