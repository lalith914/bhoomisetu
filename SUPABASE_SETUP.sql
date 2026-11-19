-- BhoomiSetu production database foundation.
-- Run this in Supabase SQL Editor before connecting the app.

create extension if not exists postgis;

create table if not exists public.lands (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  area text not null,
  land_type text not null,
  latitude double precision,
  longitude double precision,
  survey_number text,
  asking_price text,
  description text,
  verified boolean not null default false,
  verification_level text not null default 'PENDING',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.land_boundaries (
  id uuid primary key default gen_random_uuid(),
  land_id uuid not null unique references public.lands(id) on delete cascade,
  boundary geometry(Polygon, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lands_owner_id_idx on public.lands(owner_id);
create index if not exists lands_verified_idx on public.lands(verified);
create index if not exists land_boundaries_gix on public.land_boundaries using gist(boundary);

alter table public.lands enable row level security;
alter table public.land_boundaries enable row level security;

create or replace function public.is_bhoomisetu_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'), false);
$$;

create table if not exists public.report_payments (
  id uuid primary key default gen_random_uuid(),
  report_id text not null,
  email text not null,
  razorpay_order_id text not null unique,
  razorpay_payment_id text not null unique,
  amount integer not null,
  currency text not null default 'INR',
  status text not null default 'captured',
  created_at timestamptz not null default now()
);

create index if not exists report_payments_report_idx on public.report_payments(report_id);

-- Public buyers can see only verified listing records through the app API.
drop policy if exists "verified lands are public" on public.lands;
create policy "verified lands are public"
on public.lands for select
using (verified = true or owner_id = auth.uid() or public.is_bhoomisetu_admin());

-- Owners can create their own records.
drop policy if exists "owners create own lands" on public.lands;
create policy "owners create own lands"
on public.lands for insert
to authenticated
with check (owner_id = auth.uid() or public.is_bhoomisetu_admin());

-- Owners can update their own records; admins can update all.
drop policy if exists "owners update own lands" on public.lands;
create policy "owners update own lands"
on public.lands for update
to authenticated
using (owner_id = auth.uid() or public.is_bhoomisetu_admin())
with check (owner_id = auth.uid() or public.is_bhoomisetu_admin());

-- Boundary visibility follows the land record.
drop policy if exists "boundary follows land access" on public.land_boundaries;
create policy "boundary follows land access"
on public.land_boundaries for select
using (
  exists (
    select 1 from public.lands l
    where l.id = land_id
      and (l.verified = true or l.owner_id = auth.uid() or public.is_bhoomisetu_admin())
  )
);

drop policy if exists "owners create boundaries" on public.land_boundaries;
create policy "owners create boundaries"
on public.land_boundaries for insert
to authenticated
with check (
  exists (
    select 1 from public.lands l
    where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())
  )
);

drop policy if exists "owners update boundaries" on public.land_boundaries;
create policy "owners update boundaries"
on public.land_boundaries for update
to authenticated
using (
  exists (
    select 1 from public.lands l
    where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())
  )
)
with check (
  exists (
    select 1 from public.lands l
    where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())
  )
);

create or replace function public.save_land_boundary(
  p_land_id uuid,
  p_boundary_wkt text
)
returns void
language plpgsql
security invoker
as $$
begin
  if not exists (
    select 1 from public.lands
    where id = p_land_id
      and (owner_id = auth.uid() or public.is_bhoomisetu_admin())
  ) then
    raise exception 'Not authorized to save this boundary';
  end if;

  insert into public.land_boundaries (land_id, boundary)
  values (p_land_id, ST_GeomFromText(p_boundary_wkt, 4326))
  on conflict (land_id)
  do update set boundary = excluded.boundary, updated_at = now();
end;
$$;


create or replace function public.get_land_boundary(p_land_id uuid)
returns jsonb
language sql
security invoker
stable
as $$
  select ST_AsGeoJSON(boundary)::jsonb
  from public.land_boundaries
  where land_id = p_land_id;
$$;


-- Payment records are server-only. Do not grant public SELECT/INSERT access.
alter table public.report_payments enable row level security;

-- The application server may write payment records using SUPABASE_SECRET_KEY.
-- No browser policy is intentionally created for this table.

-- Property evidence: public listing photos. Create the bucket once if it does not exist.
insert into storage.buckets (id, name, public)
values ('land-photos', 'land-photos', true)
on conflict (id) do update set public = true;

create table if not exists public.land_photos (
  id uuid primary key default gen_random_uuid(),
  land_id uuid not null references public.lands(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists land_photos_land_id_idx on public.land_photos(land_id);

alter table public.land_photos enable row level security;

drop policy if exists "verified land photos are public" on public.land_photos;
create policy "verified land photos are public"
on public.land_photos for select
using (exists (select 1 from public.lands l where l.id = land_id and (l.verified = true or l.owner_id = auth.uid() or public.is_bhoomisetu_admin())));

drop policy if exists "owners create land photos" on public.land_photos;
create policy "owners create land photos"
on public.land_photos for insert
to authenticated
with check (exists (select 1 from public.lands l where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())));

drop policy if exists "owners update land photos" on public.land_photos;
create policy "owners update land photos"
on public.land_photos for update
to authenticated
using (exists (select 1 from public.lands l where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())))
with check (exists (select 1 from public.lands l where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())));

drop policy if exists "owners delete land photos" on public.land_photos;
create policy "owners delete land photos"
on public.land_photos for delete
to authenticated
using (exists (select 1 from public.lands l where l.id = land_id and (l.owner_id = auth.uid() or public.is_bhoomisetu_admin())));

-- Storage access follows the owner folder: {auth.uid()}/{land_id}/...
drop policy if exists "land photo uploads" on storage.objects;
create policy "land photo uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'land-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "land photo public read" on storage.objects;
create policy "land photo public read"
on storage.objects for select
to public
using (bucket_id = 'land-photos');

drop policy if exists "land photo owner delete" on storage.objects;
create policy "land photo owner delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'land-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Survey provenance prevents an automatically guessed number from looking verified.
alter table public.lands add column if not exists survey_source text;
alter table public.lands add column if not exists survey_verified boolean not null default false;
alter table public.lands add column if not exists cadastral_reference text;
