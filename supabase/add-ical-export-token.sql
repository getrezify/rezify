-- Export feed token per property (public iCal URL: /api/ical/<token>)
-- Run in Supabase SQL Editor

alter table public.properties
  add column if not exists ical_token uuid default gen_random_uuid();

create unique index if not exists properties_ical_token_unique
  on public.properties (ical_token);

update public.properties
set ical_token = gen_random_uuid()
where ical_token is null;

alter table public.properties
  alter column ical_token set not null;
