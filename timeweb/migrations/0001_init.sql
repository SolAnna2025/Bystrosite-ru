-- Быстросайт — Timeweb Cloud Postgres schema (Moscow region).
-- Run this once against the Timeweb database, after you have its
-- host/port/user/password (see .env.example — set them as Render env vars,
-- never in code). This is a plain Postgres instance with no PostgREST/
-- anon-key layer in front of it — only server.js (lib/timeweb.js) ever
-- connects, using a real DB user/password, so there is no RLS/policy story
-- here the way supabase/migrations/0001_init.sql needed one.
--
-- Structure mirrors the phone-related tables that used to live in
-- Supabase (supabase/migrations/0001_init.sql, 0002_finalize_and_credits.sql):
-- agents, phone_whitelist, phone_claims. Supabase's `listings` table keeps
-- a `listings.agent_id` column (see supabase/migrations/0007_agent_id_link.sql)
-- pointing at agents.agent_id here instead of storing the phone directly —
-- server.js is the only thing that ever joins the two, since it's the only
-- thing with credentials for both databases.
--
-- This migration does not move any existing production data — it only
-- creates empty tables. Backfilling agents from Supabase's current
-- phone_whitelist/agents rows (and existing listings' agent_phone) is a
-- separate, explicit step to run only after you confirm it.

-- ============================================================
-- 1. agents — one row per agent phone number, credits + subscription
--    shared across every listing that phone owns (same model as
--    Supabase's agents table, just relocated here).
-- ============================================================
create table if not exists public.agents (
  agent_id            uuid primary key default gen_random_uuid(),

  -- Stored exactly as the agent typed it (e.g. "+7 937 166-75-55") — this
  -- is what gets shown to buyers on the presentation page (see
  -- server.js twGetAgentPhoneDisplay / handlePublicListingView). One
  -- canonical display string per normalized phone, kept in sync on every
  -- ensureAgentByPhone() upsert.
  phone               text not null,
  -- Mirrors normalizePhone() in server.js and the same generated-column
  -- pattern Supabase's listings.agent_phone_normalized already used:
  -- digits only, last 10 kept — so "+7 937 166-75-55" / "89371667555" /
  -- "9371667555" all key into the same agents row.
  phone_normalized    text generated always as
    (right(regexp_replace(phone, '\D', '', 'g'), 10)) stored,

  package_credits     integer not null default 0 check (package_credits >= 0),
  -- A date, not a plain boolean: subscriptions expire on their own on
  -- renewal day without needing a second write to flip a flag off.
  -- "Unlimited is active" = subscription_until is not null and in the future.
  subscription_until  timestamptz,
  -- true once this phone number has used its one free finalization, on
  -- any listing, ever (same semantics as Supabase's agents.free_finalize_used).
  free_finalize_used  boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists idx_agents_phone_normalized
  on public.agents (phone_normalized);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. phone_whitelist — numbers that always read as "unlimited"
--    (structure + seed rows carried over from Supabase's table).
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
-- 3. phone_claims — carried over from Supabase's table for structural
--    parity. Not currently read or written by server.js (same as it
--    wasn't in Supabase either, since 0002_finalize_and_credits.sql) —
--    kept in case a future "one claim per phone" feature needs it.
--    listing_id is a plain uuid, not a foreign key: listings live in a
--    different database now, so there's nothing here to reference.
-- ============================================================
create table if not exists public.phone_claims (
  phone_normalized  text primary key,
  listing_id        uuid,
  first_used_at     timestamptz not null default now()
);

-- ============================================================
-- 4. payments — carried over from Supabase's table (0004_prodamus_payments.sql).
--    Not named in the original migration request, but it stores the same
--    phone_normalized as agents/phone_whitelist — leaving it behind in
--    Supabase would undermine the same localization goal, so it moves too.
--    One row per successfully processed payform webhook, keyed by our own
--    order_num — processProdamusPayment() (server.js) inserts here first and
--    only credits the agent if that insert actually succeeds (a duplicate
--    order_num hits the primary key and fails), so a resent webhook
--    notification is a no-op instead of double-crediting the wallet.
-- ============================================================
create table if not exists public.payments (
  order_num         text primary key,
  phone_normalized  text not null,
  plan              text not null,
  sum               numeric,
  created_at        timestamptz not null default now()
);
