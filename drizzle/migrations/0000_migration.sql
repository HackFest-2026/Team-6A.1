create type public.app_role as enum ('admin','doctor','patient');
create type public.doctor_status as enum ('PENDING','UNDER_REVIEW','VERIFIED','REJECTED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  date_of_birth date,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'patient') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thumbnail text,
  label text not null check (label in ('NORMAL','PNEUMONIA')),
  probability double precision not null check (probability >= 0 and probability <= 1),
  model_id text not null,
  model_version text not null,
  inference_ms integer,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.scans to authenticated;
grant all on public.scans to service_role;
alter table public.scans enable row level security;
create policy "own scans select" on public.scans for select to authenticated using (auth.uid() = user_id);
create policy "own scans insert" on public.scans for insert to authenticated with check (auth.uid() = user_id);
create policy "own scans delete" on public.scans for delete to authenticated using (auth.uid() = user_id);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null,
  qualification text not null,
  specialization text not null,
  experience_years integer not null check (experience_years >= 0),
  registration_number text not null,
  council text not null,
  clinic text not null,
  fee numeric not null check (fee >= 0),
  available_days text[] not null default '{}',
  available_hours text,
  status doctor_status not null default 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.doctors to authenticated;
grant all on public.doctors to service_role;
alter table public.doctors enable row level security;
create policy "verified doctors visible" on public.doctors for select to authenticated using (status = 'VERIFIED' or auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "doctor self insert" on public.doctors for insert to authenticated with check (auth.uid() = user_id and status = 'PENDING' and reviewed_by is null);
create policy "doctor self update" on public.doctors for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create or replace function public.guard_doctor_review()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if not public.has_role(auth.uid(),'admin') then
    if new.status is distinct from old.status or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Only admins can change verification status';
    end if;
  else
    if new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      if new.status = 'REJECTED' and coalesce(trim(new.rejection_reason),'') = '' then
        raise exception 'Rejection reason required';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger doctors_review_guard before update on public.doctors for each row execute function public.guard_doctor_review();

create table public.scan_shares (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (scan_id, doctor_id)
);
grant select, insert, delete on public.scan_shares to authenticated;
grant all on public.scan_shares to service_role;
alter table public.scan_shares enable row level security;
create policy "patient manages shares" on public.scan_shares for all to authenticated
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id and exists (select 1 from public.scans s where s.id = scan_id and s.user_id = auth.uid()));
create policy "doctor sees shares" on public.scan_shares for select to authenticated
  using (exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid()));

create policy "doctor reads shared scans" on public.scans for select to authenticated
  using (exists (select 1 from public.scan_shares ss join public.doctors d on d.id = ss.doctor_id
                 where ss.scan_id = scans.id and d.user_id = auth.uid() and d.status = 'VERIFIED'));

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  scheduled_at timestamptz not null,
  note text,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','CONFIRMED','CANCELLED','COMPLETED')),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "patient own appts select" on public.appointments for select to authenticated using (auth.uid() = patient_id);
create policy "patient own appts insert" on public.appointments for insert to authenticated
  with check (auth.uid() = patient_id and exists (select 1 from public.doctors d where d.id = doctor_id and d.status = 'VERIFIED'));
create policy "patient own appts update" on public.appointments for update to authenticated using (auth.uid() = patient_id);
create policy "doctor appts select" on public.appointments for select to authenticated
  using (exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid()));
create policy "doctor appts update" on public.appointments for update to authenticated
  using (exists (select 1 from public.doctors d where d.id = doctor_id and d.user_id = auth.uid()));