-- Rezify multi-tenancy: workspaces + auto-provision on signup + RLS
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)

-- ─── 1. Workspaces table ─────────────────────────────────────────────────────

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Portfolio',
  created_at timestamptz not null default now(),
  constraint workspaces_owner_id_unique unique (owner_id)
);

create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);

-- ─── 2. Auto-create workspace on signup ──────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_name text;
begin
  workspace_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(split_part(new.email, '@', 1)), ''),
    'My Portfolio'
  );

  insert into public.workspaces (owner_id, name)
  values (new.id, workspace_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── 3. Backfill workspaces for users who signed up before this trigger ─────

insert into public.workspaces (owner_id, name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(split_part(u.email, '@', 1)), ''),
    'My Portfolio'
  )
from auth.users u
where not exists (
  select 1 from public.workspaces w where w.owner_id = u.id
);

-- Optional: attach existing seed data to your user (replace YOUR_USER_UUID)
-- update public.properties set workspace_id = (select id from workspaces where owner_id = 'YOUR_USER_UUID');
-- update public.reservations set workspace_id = (select id from workspaces where owner_id = 'YOUR_USER_UUID');

-- ─── 4. Row Level Security ───────────────────────────────────────────────────

alter table public.workspaces enable row level security;
alter table public.properties enable row level security;
alter table public.reservations enable row level security;

-- Workspaces: users only see / manage their own row
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own"
  on public.workspaces for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own"
  on public.workspaces for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Properties: scoped to the user's workspace
drop policy if exists "properties_select_own_workspace" on public.properties;
create policy "properties_select_own_workspace"
  on public.properties for select
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

drop policy if exists "properties_insert_own_workspace" on public.properties;
create policy "properties_insert_own_workspace"
  on public.properties for insert
  to authenticated
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

drop policy if exists "properties_update_own_workspace" on public.properties;
create policy "properties_update_own_workspace"
  on public.properties for update
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

drop policy if exists "properties_delete_own_workspace" on public.properties;
create policy "properties_delete_own_workspace"
  on public.properties for delete
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

-- Reservations: scoped to the user's workspace
drop policy if exists "reservations_select_own_workspace" on public.reservations;
create policy "reservations_select_own_workspace"
  on public.reservations for select
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

drop policy if exists "reservations_insert_own_workspace" on public.reservations;
create policy "reservations_insert_own_workspace"
  on public.reservations for insert
  to authenticated
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

drop policy if exists "reservations_update_own_workspace" on public.reservations;
create policy "reservations_update_own_workspace"
  on public.reservations for update
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

drop policy if exists "reservations_delete_own_workspace" on public.reservations;
create policy "reservations_delete_own_workspace"
  on public.reservations for delete
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );
