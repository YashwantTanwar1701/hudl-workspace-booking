-- ==========================================================
-- WORKSPACE SEAT MIGRATION
-- Run in Supabase SQL Editor
-- Removes all old seats and inserts new ones per floor plan
-- ==========================================================

-- Step 1: Add is_locked column if it does not exist
ALTER TABLE public.seats ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Step 2: Remove ALL old bookings first (foreign key), then seats
TRUNCATE public.bookings CASCADE;
TRUNCATE public.seats CASCADE;

-- ==========================================================
-- Step 3: Insert new seats
-- Naming: <section-prefix>-<zero-padded-number>
-- Locked = seat is remotely used, cannot be booked
-- ==========================================================

-- SERVER ROOM LANE — 144 seats (windows, has machine)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT
  'SRL-' || LPAD(n::text, 3, '0'),
  '3',
  'server-room-lane',
  'windows',
  true,
  n,
  true,
  false
FROM generate_series(1, 144) AS n;

-- TOWN HALL LANE — 140 seats (windows, has machine)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT
  'THL-' || LPAD(n::text, 3, '0'),
  '3',
  'town-hall-lane',
  'windows',
  true,
  n,
  true,
  false
FROM generate_series(1, 140) AS n;

-- HR/IT ROOM LANE — 122 seats (windows, has machine)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT
  'HIL-' || LPAD(n::text, 3, '0'),
  '3',
  'hr-it-lane',
  'windows',
  true,
  n,
  true,
  false
FROM generate_series(1, 122) AS n;

-- HR/OPS/IT ROOM — 10 seats (mix: 5 mac, 5 windows)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('HOI-001','3','hr-ops-it','mac',    true, 1, true, false),
  ('HOI-002','3','hr-ops-it','mac',    true, 2, true, false),
  ('HOI-003','3','hr-ops-it','mac',    true, 3, true, false),
  ('HOI-004','3','hr-ops-it','mac',    true, 4, true, false),
  ('HOI-005','3','hr-ops-it','mac',    true, 5, true, false),
  ('HOI-006','3','hr-ops-it','windows',true, 6, true, false),
  ('HOI-007','3','hr-ops-it','windows',true, 7, true, false),
  ('HOI-008','3','hr-ops-it','windows',true, 8, true, false),
  ('HOI-009','3','hr-ops-it','windows',true, 9, true, false),
  ('HOI-010','3','hr-ops-it','windows',true,10, true, false);

-- 2-SEATER PHONE BOOTH 1 — 2 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('PB2-1A','3','phone-booth-2s-1','no-system',false,NULL,true,false),
  ('PB2-1B','3','phone-booth-2s-1','no-system',false,NULL,true,false);

-- 2-SEATER PHONE BOOTH 2 — 2 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('PB2-2A','3','phone-booth-2s-2','no-system',false,NULL,true,false),
  ('PB2-2B','3','phone-booth-2s-2','no-system',false,NULL,true,false);

-- 2-SEATER PHONE BOOTH 3 — 2 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('PB2-3A','3','phone-booth-2s-3','no-system',false,NULL,true,false),
  ('PB2-3B','3','phone-booth-2s-3','no-system',false,NULL,true,false);

-- TRAINING ROOM 1 — 20 seats (windows)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'TR1-' || LPAD(n::text,2,'0'),'3','training-room-1','windows',true,n,true,false
FROM generate_series(1,20) AS n;

-- TRAINING ROOM 2 — 24 seats (windows)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'TR2-' || LPAD(n::text,2,'0'),'3','training-room-2','windows',true,n,true,false
FROM generate_series(1,24) AS n;

-- TRAINING ROOM 3 — 24 seats (windows)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'TR3-' || LPAD(n::text,2,'0'),'3','training-room-3','windows',true,n,true,false
FROM generate_series(1,24) AS n;

-- PHONE BOOTH 1 — 1 seat (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES ('PB1-1','3','phone-booth-1s-1','no-system',false,NULL,true,false);

-- PHONE BOOTH 2 — 1 seat (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES ('PB1-2','3','phone-booth-1s-2','no-system',false,NULL,true,false);

-- PHONE BOOTH 3 — 1 seat (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES ('PB1-3','3','phone-booth-1s-3','no-system',false,NULL,true,false);

-- WELLNESS ROOM — 1 room/seat (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES ('WEL-01','3','wellness-room','no-system',false,NULL,true,false);

-- 12 PAX CONFERENCE ROOM — 12 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'CF12-' || LPAD(n::text,2,'0'),'3','conference-12pax','no-system',false,NULL,true,false
FROM generate_series(1,12) AS n;

-- 4 PAX MEETING ROOM 1 — 4 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('MR41-1','3','meeting-4pax-1','no-system',false,NULL,true,false),
  ('MR41-2','3','meeting-4pax-1','no-system',false,NULL,true,false),
  ('MR41-3','3','meeting-4pax-1','no-system',false,NULL,true,false),
  ('MR41-4','3','meeting-4pax-1','no-system',false,NULL,true,false);

-- 4 PAX MEETING ROOM 2 — 4 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('MR42-1','3','meeting-4pax-2','no-system',false,NULL,true,false),
  ('MR42-2','3','meeting-4pax-2','no-system',false,NULL,true,false),
  ('MR42-3','3','meeting-4pax-2','no-system',false,NULL,true,false),
  ('MR42-4','3','meeting-4pax-2','no-system',false,NULL,true,false);

-- 4 PAX MEETING ROOM 3 — 4 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('MR43-1','3','meeting-4pax-3','no-system',false,NULL,true,false),
  ('MR43-2','3','meeting-4pax-3','no-system',false,NULL,true,false),
  ('MR43-3','3','meeting-4pax-3','no-system',false,NULL,true,false),
  ('MR43-4','3','meeting-4pax-3','no-system',false,NULL,true,false);

-- PRODUCT TEAM ROOM — 8 seats (4 mac, 4 windows)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
VALUES
  ('PT-001','3','product-team','mac',    true,1,true,false),
  ('PT-002','3','product-team','mac',    true,2,true,false),
  ('PT-003','3','product-team','mac',    true,3,true,false),
  ('PT-004','3','product-team','mac',    true,4,true,false),
  ('PT-005','3','product-team','windows',true,5,true,false),
  ('PT-006','3','product-team','windows',true,6,true,false),
  ('PT-007','3','product-team','windows',true,7,true,false),
  ('PT-008','3','product-team','windows',true,8,true,false);

-- CAFETERIA ZONE — 90 seats (no system)
INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active, is_locked)
SELECT 'CAF-' || LPAD(n::text,3,'0'),'3','cafeteria-zone','no-system',false,NULL,true,false
FROM generate_series(1,90) AS n;

-- ==========================================================
-- Step 4: Lock example remote seats (adjust as needed)
-- Lock the first 10 seats of Server Room Lane (remotely used)
-- ==========================================================
UPDATE public.seats SET is_locked = true
WHERE section = 'server-room-lane'
  AND seat_number IN ('SRL-001','SRL-002','SRL-003','SRL-004','SRL-005','SRL-006','SRL-007','SRL-008','SRL-009','SRL-010');

-- ==========================================================
-- Step 5: Verify counts
-- ==========================================================
SELECT section, COUNT(*) as total, SUM(CASE WHEN is_locked THEN 1 ELSE 0 END) as locked
FROM public.seats
GROUP BY section
ORDER BY section;
