-- Digital Falak temporary schema.
-- All objects are isolated with df_ prefix so they can be migrated later.

create table if not exists public.df_falak_methods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parameters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_verified boolean not null default false,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  calculator_type text not null check (calculator_type in ('prayer_times','qibla','solar','lunar','hilal','calendar','rashdul_qibla')),
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
alter table public.df_saved_locations enable row level security;
alter table public.df_calculation_history enable row level security;
alter table public.df_user_settings enable row level security;

revoke all on public.df_falak_methods from anon, authenticated;
revoke all on public.df_saved_locations from anon, authenticated;
revoke all on public.df_calculation_history from anon, authenticated;
revoke all on public.df_user_settings from anon, authenticated;

grant select on public.df_falak_methods to anon, authenticated;
grant select, insert, update, delete on public.df_saved_locations to authenticated;
grant select, insert, update, delete on public.df_calculation_history to authenticated;
grant select, insert, update, delete on public.df_user_settings to authenticated;

drop policy if exists "df_methods_public_read" on public.df_falak_methods;
create policy "df_methods_public_read" on public.df_falak_methods
for select to anon, authenticated using (is_active = true);

drop policy if exists "df_locations_owner_select" on public.df_saved_locations;
create policy "df_locations_owner_select" on public.df_saved_locations
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "df_locations_owner_insert" on public.df_saved_locations;
create policy "df_locations_owner_insert" on public.df_saved_locations
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "df_locations_owner_update" on public.df_saved_locations;
create policy "df_locations_owner_update" on public.df_saved_locations
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "df_locations_owner_delete" on public.df_saved_locations;
create policy "df_locations_owner_delete" on public.df_saved_locations
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "df_history_owner_select" on public.df_calculation_history;
create policy "df_history_owner_select" on public.df_calculation_history
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "df_history_owner_insert" on public.df_calculation_history;
create policy "df_history_owner_insert" on public.df_calculation_history
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "df_history_owner_update" on public.df_calculation_history;
create policy "df_history_owner_update" on public.df_calculation_history
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "df_history_owner_delete" on public.df_calculation_history;
create policy "df_history_owner_delete" on public.df_calculation_history
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "df_settings_owner_select" on public.df_user_settings;
create policy "df_settings_owner_select" on public.df_user_settings
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "df_settings_owner_insert" on public.df_user_settings;
create policy "df_settings_owner_insert" on public.df_user_settings
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "df_settings_owner_update" on public.df_user_settings;
create policy "df_settings_owner_update" on public.df_user_settings
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "df_settings_owner_delete" on public.df_user_settings;
create policy "df_settings_owner_delete" on public.df_user_settings
for delete to authenticated using ((select auth.uid()) = user_id);

insert into public.df_falak_methods (slug, name, description, parameters, is_active, is_verified, source_note)
values (
  'digital-falak-default-test',
  'Default Indonesia — Uji',
  'Parameter awal untuk pengujian engine. Bukan rumus final pengguna.',
  '{"fajr_angle":20,"isha_angle":18,"dhuha_altitude":4.5,"asr_shadow_factor":1,"ihtiyat_minutes":2}'::jsonb,
  true,
  false,
  'Metode uji internal. Ganti dengan rumus rujukan pengguna sebelum dipakai sebagai acuan final.'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  parameters = excluded.parameters,
  is_active = excluded.is_active,
  is_verified = excluded.is_verified,
  source_note = excluded.source_note,
  updated_at = now();

create index if not exists df_saved_locations_user_id_idx on public.df_saved_locations(user_id);
create index if not exists df_calculation_history_user_id_idx on public.df_calculation_history(user_id);
create index if not exists df_calculation_history_method_id_idx on public.df_calculation_history(method_id);
create index if not exists df_user_settings_default_method_id_idx on public.df_user_settings(default_method_id);
