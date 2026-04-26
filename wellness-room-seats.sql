-- =====================================================
-- ADD WELLNESS ROOM SEATS
-- Run in Supabase SQL Editor
-- =====================================================

INSERT INTO public.seats (seat_number, floor, section, os_type, has_machine, machine_number, is_active)
VALUES
  ('WR-01', '3', 'wellness-room', 'other', false, null, true),
  ('WR-02', '3', 'wellness-room', 'other', false, null, true),
  ('WR-03', '3', 'wellness-room', 'other', false, null, true),
  ('WR-04', '3', 'wellness-room', 'other', false, null, true),
  ('WR-05', '3', 'wellness-room', 'other', false, null, true),
  ('WR-06', '3', 'wellness-room', 'other', false, null, true),
  ('WR-07', '3', 'wellness-room', 'other', false, null, true),
  ('WR-08', '3', 'wellness-room', 'other', false, null, true),
  ('WR-09', '3', 'wellness-room', 'other', false, null, true),
  ('WR-10', '3', 'wellness-room', 'other', false, null, true)
ON CONFLICT (seat_number) DO NOTHING;

-- Verify
SELECT seat_number, section, os_type, is_active
FROM public.seats
WHERE section = 'wellness-room'
ORDER BY seat_number;
