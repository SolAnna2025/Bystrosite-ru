-- Быстросайт — initial Supabase schema.
-- Run this once in the new "prezent" project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- Security model (why there are almost no policies for anon/authenticated below):
--   - RLS is enabled on every table with ZERO permissive policies for anon/authenticated.
--     That means the tables are completely unreachable through the public REST API —
--     not "readable but filtered", genuinely unreachable. This is what makes "нельзя
--     прочитать список целиком" actually true, rather than relying on a USING(true)
--     policy that would let anyone page through every row.
--   - The one public read path is the get_listing_by_id() function below: SECURITY
--     DEFINER, requires an exact id, returns one row. Since a listing's id is a
--     random uuid (not sequential/guessable), the only way to fetch a row is already
--     having its link — there is no way to enumerate listings through this function.
--   - Every write (create/update a listing, record a phone claim) happens from your
--     own server using the service_role key, which bypasses RLS entirely by design.
--     The anon key (used by the browser) never gets INSERT/UPDATE rights on these
--     tables — that's Stage 2 (wiring server.js), not this migration.

-- ============================================================
-- 1. listings — one row per generated presentation
-- ============================================================
create table if not exists public.listings (
  id                    uuid primary key default gen_random_uuid(),

  property_type         text not null default 'villa',
  title                 text not null,
  description           text,
  emotion_phrase        text,
  closing_phrase        text,

  location_name         text not null,
  lat                   double precision not null,
  lng                   double precision not null,

  currency              text not null default 'THB',
  sale_price            numeric,
  rent_price            numeric,
  rent_period           text,
  rent_market_range     text,

  house_area            numeric not null,
  plot_area             numeric,
  bedrooms              int not null default 0,
  bathrooms             int not null default 0,
  pool_size             text,
  yard                  text,
  floors                int,
  floor_number          int,
  furnished             text,
  garage_spaces         int,
  security              boolean not null default true,
  auto_gate             boolean not null default true,
  extra_features        text,
  nearby                text,

  management_company    text,
  cam_fee               numeric,
  cleaning_fee          numeric,
  cleaning_period       text,
  pool_maintenance_fee  numeric,

  company_name          text,
  logo_path             text,                          -- storage object path, bucket "bystrosite"

  agent_name            text,
  agent_phone           text not null,
  -- Mirrors normalizePhone() in server.js: digits only, last 10 kept — so
  -- "+7 937 166-75-55" / "89371667555" / "9371667555" all normalize the same,
  -- and this column is what the whitelist and phone_claims tables match against.
  agent_phone_normalized text generated always as
    (right(regexp_replace(agent_phone, '\D', '', 'g'), 10)) stored,
  agent_photo_path      text,
  agent_messengers      text[] not null default '{}',
  agent_qr              jsonb not null default '{}'::jsonb,   -- { whatsapp: path, telegram: path }

  photos                jsonb not null default '{}'::jsonb,   -- { slotKey: storage path }

  is_paid               boolean not null default false,
  paid_tier             smallint not null default 0 check (paid_tier in (0, 1, 2)), -- 0 free/watermark, 1 paid (single/pack), 2 unlimited

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_listings_agent_phone_normalized
  on public.listings (agent_phone_normalized);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. phone_whitelist — numbers exempt from the "one free listing" limit
-- ============================================================
create table if not exists public.phone_whitelist (
  phone_normalized  text primary key,
  label             text,                        -- human-readable original number, for reference
  created_at        timestamptz not null default now()
);

insert into public.phone_whitelist (phone_normalized, label) values
  ('6922881848', '+66 92 288 1848'),
  ('9371667555', '+7 937 166 75 55')
on conflict (phone_normalized) do nothing;

-- ============================================================
-- 3. phone_claims — DB-backed replacement for data/used-phones.json
-- ============================================================
create table if not exists public.phone_claims (
  phone_normalized  text primary key,
  listing_id        uuid references public.listings(id) on delete set null,
  first_used_at     timestamptz not null default now()
);

-- ============================================================
-- 4. Lock every table down: RLS on, no policies for anon/authenticated.
--    service_role (used only by your server) bypasses RLS automatically.
-- ============================================================
alter table public.listings       enable row level security;
alter table public.phone_whitelist enable row level security;
alter table public.phone_claims    enable row level security;

revoke all on public.listings        from anon, authenticated;
revoke all on public.phone_whitelist from anon, authenticated;
revoke all on public.phone_claims    from anon, authenticated;

-- ============================================================
-- 5. The one public read path: fetch exactly one listing by its id.
--    SECURITY DEFINER bypasses RLS internally; anon only gets EXECUTE on
--    this function, never SELECT on the table itself.
-- ============================================================
create or replace function public.get_listing_by_id(p_id uuid)
returns setof public.listings
language sql
security definer
set search_path = public
as $$
  select * from public.listings where id = p_id;
$$;

grant execute on function public.get_listing_by_id(uuid) to anon, authenticated;

-- ============================================================
-- 6. Storage — photos live in Storage, not as base64 in the table.
--    One public bucket; reads are public (needed for <img src> in the
--    deck/PDF), writes are service_role-only (no policy for anon/authenticated).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('bystrosite', 'bystrosite', true)
on conflict (id) do nothing;

drop policy if exists "bystrosite public read" on storage.objects;
create policy "bystrosite public read"
  on storage.objects for select
  using (bucket_id = 'bystrosite');

-- No insert/update/delete policy is created here on purpose — uploads go
-- through the server (service_role key), which bypasses storage RLS too.
