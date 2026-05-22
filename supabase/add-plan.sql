-- Add subscription plan tier to workspaces
-- Run in Supabase SQL Editor if workspaces already exists

alter table public.workspaces
  add column if not exists plan text not null default 'starter';

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('starter', 'pro'));
