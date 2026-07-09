
-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'appliance',
  location text,
  rated_power_w numeric not null default 0,
  threshold_kwh numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.devices to authenticated;
grant all on public.devices to service_role;
alter table public.devices enable row level security;
create index devices_user_id_idx on public.devices(user_id);

create table public.energy_readings (
  id bigserial primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  power_w numeric not null,
  energy_kwh numeric not null default 0,
  voltage_v numeric,
  current_a numeric,
  recorded_at timestamptz not null default now()
);
grant select, insert, update, delete on public.energy_readings to authenticated;
grant all on public.energy_readings to service_role;
alter table public.energy_readings enable row level security;
create index energy_readings_device_ts_idx on public.energy_readings(device_id, recorded_at desc);
create index energy_readings_user_ts_idx on public.energy_readings(user_id, recorded_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  type text not null,
  severity text not null default 'info',
  message text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.alerts to authenticated;
grant all on public.alerts to service_role;
alter table public.alerts enable row level security;
create index alerts_user_id_idx on public.alerts(user_id, created_at desc);

-- Policies
create policy "profiles_select_self_or_admin" on public.profiles for select
  to authenticated using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_self" on public.profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_self" on public.profiles for insert
  to authenticated with check (auth.uid() = id);

create policy "user_roles_select_self_or_admin" on public.user_roles for select
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "user_roles_admin_manage" on public.user_roles for all
  to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "devices_owner_or_admin_select" on public.devices for select
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "devices_owner_insert" on public.devices for insert
  to authenticated with check (auth.uid() = user_id);
create policy "devices_owner_or_admin_update" on public.devices for update
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "devices_owner_or_admin_delete" on public.devices for delete
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "readings_owner_or_admin_select" on public.energy_readings for select
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "readings_owner_insert" on public.energy_readings for insert
  to authenticated with check (auth.uid() = user_id);
create policy "readings_owner_or_admin_delete" on public.energy_readings for delete
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "alerts_owner_or_admin_select" on public.alerts for select
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "alerts_owner_insert" on public.alerts for insert
  to authenticated with check (auth.uid() = user_id);
create policy "alerts_owner_update" on public.alerts for update
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "alerts_owner_delete" on public.alerts for delete
  to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger devices_updated_at before update on public.devices
  for each row execute function public.set_updated_at();

-- Auto-create profile + default 'user' role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
