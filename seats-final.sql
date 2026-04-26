-- ================================================================
-- WORKSPACE SEAT REBUILD
-- Compatible with your existing DB structure:
--   - os_type column is seat_os enum (mac | windows | other)
--   - No is_locked column yet (we add it here)
--   - Uses INSERT with ON CONFLICT for safety
--
-- OS mapping:
--   'mac'     → macOS machines
--   'windows' → Windows machines
--   'other'   → Seat Only (no PC) — replaces "no-system" label in UI
--
-- Distribution:
--   Mac       190  (SRL 50 + THL 140)
--   Windows   368  (SRL 94 + HIL 122 + HOI 10 + TR 68 + PT 8 + CAF 66)
--   Other      58  (booths 9 + wellness 1 + conf 12 + mtg 12 + CAF 24)
--   Locked      5  (SRL 001-005, Windows, remote seats)
--   Total     616
-- ================================================================

-- ── Step 1: Add is_locked column if missing ────────────────────
ALTER TABLE public.seats
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- ── Step 2: Wipe all existing seats and bookings ───────────────
TRUNCATE public.bookings CASCADE;
TRUNCATE public.seats    CASCADE;

-- ================================================================
-- SERVER ROOM LANE — 144 seats
--   SRL-001 to SRL-005   Windows, LOCKED (remote seats)
--   SRL-006 to SRL-055   Mac (50 seats)
--   SRL-056 to SRL-144   Windows bookable (89 seats)
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'SRL-'||LPAD(n::text,3,'0'), '3', 'server-room-lane', 'windows'::seat_os, true,  n,    true, true
FROM generate_series(1,5) AS n

UNION ALL

SELECT 'SRL-'||LPAD(n::text,3,'0'), '3', 'server-room-lane', 'mac'::seat_os,     true,  n,    true, false
FROM generate_series(6,55) AS n

UNION ALL

SELECT 'SRL-'||LPAD(n::text,3,'0'), '3', 'server-room-lane', 'windows'::seat_os, true,  n,    true, false
FROM generate_series(56,144) AS n;

-- ================================================================
-- TOWN HALL LANE — 140 Mac
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'THL-'||LPAD(n::text,3,'0'), '3', 'town-hall-lane', 'mac'::seat_os, true, n, true, false
FROM generate_series(1,140) AS n;

-- ================================================================
-- HR/IT ROOM LANE — 122 Windows
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'HIL-'||LPAD(n::text,3,'0'), '3', 'hr-it-lane', 'windows'::seat_os, true, n, true, false
FROM generate_series(1,122) AS n;

-- ================================================================
-- HR/OPS/IT ROOM — 10 Windows
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'HOI-'||LPAD(n::text,2,'0'), '3', 'hr-ops-it', 'windows'::seat_os, true, n, true, false
FROM generate_series(1,10) AS n;

-- ================================================================
-- TRAINING ROOMS — Windows
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'TR1-'||LPAD(n::text,2,'0'), '3', 'training-room-1', 'windows'::seat_os, true, n, true, false
FROM generate_series(1,20) AS n

UNION ALL

SELECT 'TR2-'||LPAD(n::text,2,'0'), '3', 'training-room-2', 'windows'::seat_os, true, n, true, false
FROM generate_series(1,24) AS n

UNION ALL

SELECT 'TR3-'||LPAD(n::text,2,'0'), '3', 'training-room-3', 'windows'::seat_os, true, n, true, false
FROM generate_series(1,24) AS n;

-- ================================================================
-- PRODUCT TEAM — 8 Windows
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'PT-'||LPAD(n::text,2,'0'), '3', 'product-team', 'windows'::seat_os, true, n, true, false
FROM generate_series(1,8) AS n;

-- ================================================================
-- CAFETERIA ZONE — 90 seats
--   CAF-001 to CAF-066  Windows (fills gap to reach 368 total)
--   CAF-067 to CAF-090  Other/no-system (casual seats, no PC)
-- ================================================================
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'CAF-'||LPAD(n::text,3,'0'), '3', 'cafeteria-zone', 'windows'::seat_os, true,  n,    true, false
FROM generate_series(1,66) AS n

UNION ALL

SELECT 'CAF-'||LPAD(n::text,3,'0'), '3', 'cafeteria-zone', 'other'::seat_os,   false, NULL, true, false
FROM generate_series(67,90) AS n;

-- ================================================================
-- NO-SYSTEM SECTIONS — 'other' os_type (seat only, no PC)
-- ================================================================

-- 2-Seater Phone Booths (6 seats)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked) VALUES
  ('PB2-1A','3','phone-booth-2s-1','other'::seat_os,false,NULL,true,false),
  ('PB2-1B','3','phone-booth-2s-1','other'::seat_os,false,NULL,true,false),
  ('PB2-2A','3','phone-booth-2s-2','other'::seat_os,false,NULL,true,false),
  ('PB2-2B','3','phone-booth-2s-2','other'::seat_os,false,NULL,true,false),
  ('PB2-3A','3','phone-booth-2s-3','other'::seat_os,false,NULL,true,false),
  ('PB2-3B','3','phone-booth-2s-3','other'::seat_os,false,NULL,true,false);

-- 1-Seater Phone Booths (3 seats)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked) VALUES
  ('PB1-1','3','phone-booth-1s-1','other'::seat_os,false,NULL,true,false),
  ('PB1-2','3','phone-booth-1s-2','other'::seat_os,false,NULL,true,false),
  ('PB1-3','3','phone-booth-1s-3','other'::seat_os,false,NULL,true,false);

-- Wellness Room (1 seat)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked) VALUES
  ('WEL-01','3','wellness-room','other'::seat_os,false,NULL,true,false);

-- 12 PAX Conference Room (12 seats)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'CF12-'||LPAD(n::text,2,'0'), '3', 'conference-12pax', 'other'::seat_os, false, NULL, true, false
FROM generate_series(1,12) AS n;

-- 4 PAX Meeting Rooms (12 seats total)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked) VALUES
  ('MR41-1','3','meeting-4pax-1','other'::seat_os,false,NULL,true,false),
  ('MR41-2','3','meeting-4pax-1','other'::seat_os,false,NULL,true,false),
  ('MR41-3','3','meeting-4pax-1','other'::seat_os,false,NULL,true,false),
  ('MR41-4','3','meeting-4pax-1','other'::seat_os,false,NULL,true,false),
  ('MR42-1','3','meeting-4pax-2','other'::seat_os,false,NULL,true,false),
  ('MR42-2','3','meeting-4pax-2','other'::seat_os,false,NULL,true,false),
  ('MR42-3','3','meeting-4pax-2','other'::seat_os,false,NULL,true,false),
  ('MR42-4','3','meeting-4pax-2','other'::seat_os,false,NULL,true,false),
  ('MR43-1','3','meeting-4pax-3','other'::seat_os,false,NULL,true,false),
  ('MR43-2','3','meeting-4pax-3','other'::seat_os,false,NULL,true,false),
  ('MR43-3','3','meeting-4pax-3','other'::seat_os,false,NULL,true,false),
  ('MR43-4','3','meeting-4pax-3','other'::seat_os,false,NULL,true,false);

-- ================================================================
-- VERIFICATION — Expected results:
--
--  os_type  | total | locked | bookable
--  ---------+-------+--------+---------
--  mac      |   190 |      0 |     190
--  other    |    58 |      0 |      58
--  windows  |   368 |      5 |     363
--  Total    |   616
-- ================================================================
SELECT
  os_type,
  COUNT(*)                                             AS total,
  SUM(CASE WHEN is_locked     THEN 1 ELSE 0 END)      AS locked,
  SUM(CASE WHEN NOT is_locked THEN 1 ELSE 0 END)      AS bookable
FROM public.seats
GROUP BY os_type
ORDER BY os_type;

SELECT
  section,
  COUNT(*)                                             AS total,
  SUM(CASE WHEN is_locked     THEN 1 ELSE 0 END)      AS locked
FROM public.seats
GROUP BY section
ORDER BY section;

SELECT COUNT(*) AS grand_total FROM public.seats;
