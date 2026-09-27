-- DIGITAL FALAK - current temporary Supabase schema
-- Objects are intentionally isolated with df_ prefix for later migration.

create table if not exists public.df_falak_methods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parameters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_verified boolean not null default false,
  source_note text,
  engine_type text not null default 'nrel_spa',
  version text not null default '1.0',
  status text not null default 'draft',
  formula_notes jsonb not null default '{}'::jsonb,
  reference_urls jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint df_falak_methods_engine_type_check check (engine_type in ('nrel_spa','legacy_noaa','custom')),
  constraint df_falak_methods_status_check check (status in ('draft','published','archived'))
);

create table if not exists public.df_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'falak_expert' check (role in ('owner','falak_expert','editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.df_admin_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  requested_at timestamptz not null default now()
);

create table if not exists public.df_formula_definitions (
  id uuid primary key default gen_random_uuid(),
  method_id uuid not null references public.df_falak_methods(id) on delete cascade,
  slot text not null,
  label text not null,
  expression text not null,
  variables jsonb not null default '[]'::jsonb,
  output_unit text,
  description text,
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(method_id, slot)
);

create table if not exists public.df_saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  elevation double precision not null default 0,
  timezone numeric(4,2) not null default 0 check (timezone between -14 and 14),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.df_calculation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calculator_type text not null check (
    calculator_type in ('prayer_times','qibla','solar','lunar','hilal','calendar','rashdul_qibla')
  ),
  method_id uuid references public.df_falak_methods(id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.df_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_method_id uuid references public.df_falak_methods(id) on delete set null,
  parameters jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.df_falak_methods enable row level security;
alter table public.df_admin_users enable row level security;
alter table public.df_admin_requests enable row level security;
alter table public.df_formula_definitions enable row level security;
alter table public.df_saved_locations enable row level security;
alter table public.df_calculation_history enable row level security;
alter table public.df_user_settings enable row level security;

revoke all on public.df_falak_methods from anon, authenticated;
revoke all on public.df_formula_definitions from anon, authenticated;
revoke all on public.df_admin_users from anon, authenticated;
revoke all on public.df_admin_requests from anon, authenticated;
revoke all on public.df_saved_locations from anon, authenticated;
revoke all on public.df_calculation_history from anon, authenticated;
revoke all on public.df_user_settings from anon, authenticated;

grant select on public.df_falak_methods to anon, authenticated;
grant select, insert, update, delete on public.df_falak_methods to authenticated;
grant select on public.df_formula_definitions to anon;
grant select, insert, update, delete on public.df_formula_definitions to authenticated;
grant select on public.df_admin_users to authenticated;
grant select, insert, update on public.df_admin_requests to authenticated;
grant select, insert, update, delete on public.df_saved_locations to authenticated;
grant select, insert, update, delete on public.df_calculation_history to authenticated;
grant select, insert, update, delete on public.df_user_settings to authenticated;

-- Public methods: only published + active.
drop policy if exists "df_methods_public_read" on public.df_falak_methods;
create policy "df_methods_public_read" on public.df_falak_methods
for select to anon, authenticated
using (is_active = true and status = 'published');

-- Admins can inspect and edit every method.
drop policy if exists "df_methods_admin_select" on public.df_falak_methods;
create policy "df_methods_admin_select" on public.df_falak_methods
for select to authenticated using (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);
drop policy if exists "df_methods_admin_insert" on public.df_falak_methods;
create policy "df_methods_admin_insert" on public.df_falak_methods
for insert to authenticated with check (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);
drop policy if exists "df_methods_admin_update" on public.df_falak_methods;
create policy "df_methods_admin_update" on public.df_falak_methods
for update to authenticated
using (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
)
with check (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);
drop policy if exists "df_methods_admin_delete" on public.df_falak_methods;
create policy "df_methods_admin_delete" on public.df_falak_methods
for delete to authenticated using (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);

-- Published formulas can be read by the app.
drop policy if exists "df_formula_public_read" on public.df_formula_definitions;
create policy "df_formula_public_read" on public.df_formula_definitions
for select to anon, authenticated using (
  is_enabled = true and exists (
    select 1 from public.df_falak_methods m
    where m.id = method_id and m.is_active = true and m.status = 'published'
  )
);

drop policy if exists "df_formula_admin_select" on public.df_formula_definitions;
create policy "df_formula_admin_select" on public.df_formula_definitions
for select to authenticated using (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);
drop policy if exists "df_formula_admin_insert" on public.df_formula_definitions;
create policy "df_formula_admin_insert" on public.df_formula_definitions
for insert to authenticated with check (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);
drop policy if exists "df_formula_admin_update" on public.df_formula_definitions;
create policy "df_formula_admin_update" on public.df_formula_definitions
for update to authenticated
using (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
)
with check (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);
drop policy if exists "df_formula_admin_delete" on public.df_formula_definitions;
create policy "df_formula_admin_delete" on public.df_formula_definitions
for delete to authenticated using (
  exists (select 1 from public.df_admin_users a where a.user_id = (select auth.uid()) and a.is_active = true)
);

-- Admin identity itself is private to the signed-in owner of the row.
drop policy if exists "df_admin_self_read" on public.df_admin_users;
create policy "df_admin_self_read" on public.df_admin_users
for select to authenticated using ((select auth.uid()) = user_id and is_active = true);

drop policy if exists "df_admin_request_own_select" on public.df_admin_requests;
create policy "df_admin_request_own_select" on public.df_admin_requests
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "df_admin_request_own_insert" on public.df_admin_requests;
create policy "df_admin_request_own_insert" on public.df_admin_requests
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "df_admin_request_own_update" on public.df_admin_requests;
create policy "df_admin_request_own_update" on public.df_admin_requests
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- User-owned data.
drop policy if exists "df_locations_owner_select" on public.df_saved_locations;
create policy "df_locations_owner_select" on public.df_saved_locations for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "df_locations_owner_insert" on public.df_saved_locations;
create policy "df_locations_owner_insert" on public.df_saved_locations for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "df_locations_owner_update" on public.df_saved_locations;
create policy "df_locations_owner_update" on public.df_saved_locations for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "df_locations_owner_delete" on public.df_saved_locations;
create policy "df_locations_owner_delete" on public.df_saved_locations for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "df_history_owner_select" on public.df_calculation_history;
create policy "df_history_owner_select" on public.df_calculation_history for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "df_history_owner_insert" on public.df_calculation_history;
create policy "df_history_owner_insert" on public.df_calculation_history for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "df_history_owner_update" on public.df_calculation_history;
create policy "df_history_owner_update" on public.df_calculation_history for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "df_history_owner_delete" on public.df_calculation_history;
create policy "df_history_owner_delete" on public.df_calculation_history for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "df_settings_owner_select" on public.df_user_settings;
create policy "df_settings_owner_select" on public.df_user_settings for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "df_settings_owner_insert" on public.df_user_settings;
create policy "df_settings_owner_insert" on public.df_user_settings for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "df_settings_owner_update" on public.df_user_settings;
create policy "df_settings_owner_update" on public.df_user_settings for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "df_settings_owner_delete" on public.df_user_settings;
create policy "df_settings_owner_delete" on public.df_user_settings for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists df_saved_locations_user_id_idx on public.df_saved_locations(user_id);
create index if not exists df_calculation_history_user_id_idx on public.df_calculation_history(user_id);
create index if not exists df_calculation_history_method_id_idx on public.df_calculation_history(method_id);
create index if not exists df_user_settings_default_method_id_idx on public.df_user_settings(default_method_id);
create index if not exists df_formula_definitions_method_id_idx on public.df_formula_definitions(method_id);
create index if not exists df_falak_methods_status_idx on public.df_falak_methods(status, is_active);
