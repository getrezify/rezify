-- iCal feed URLs per property for channel sync
-- Run in Supabase SQL Editor if properties already exists

alter table public.properties
  add column if not exists airbnb_ical_url text;

alter table public.properties
  add column if not exists booking_ical_url text;
