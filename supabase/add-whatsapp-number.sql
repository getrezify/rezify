-- Add per-workspace WhatsApp notification recipient
-- Run in Supabase SQL Editor if workspaces already exists

alter table public.workspaces
  add column if not exists whatsapp_number text;
