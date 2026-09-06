-- Быстросайт — finalize/credits model.
-- Run once in the Supabase SQL Editor, after 0001_init.sql.
--
-- New rule this migration implements: editing a listing is always free and
-- unlimited *until* the agent finalizes it (clicks "Поделиться презентацией"
-- or "Скачать PDF"). Finalizing locks that one listing. Each listing gets
-- exactly one free finalization; every finalization after that spends one
-- credit from the agent's own wallet (shared across all their listings), or
-- is free for the whole time an unlimited subscription is active. Creating
-- a brand-new listing is never blocked, regardless of credits.
--
-- This supersedes the old "one free listing per phone number, ever" model
-- from 0001_init.sql (phone_claims blocking a second listing outright) —
-- server.js no longer reads or writes phone_claims. It's left in place
-- rather than dropped since it's harmless and this isn't a destructive
-- migration; a future cleanup can drop it once nothing references it.
-- phone_whitelist is *kept and repurposed*: a whitelisted number now reads
-- as "always has an active unlimited subscription" (see agents_is_unlimited
-- below) instead of "exempt from the old one-listing limit" — same intent
-- (this number should never be gated), same table, new meaning.

-- ============================================================
-- 1. listings — per-object finalize state
-- ============================================================
alter table public.listings add column if not exists is_finalized boolean not null default false;
alter table public.listings add column if not exists free_finalize_used boolean not null default false;

comment on column public.listings.is_finalized is
  'true once this listing has been shared or downloaded as a PDF — editing is blocked while true, unless the agent has credits/an unlimited subscription (see agents table).';
comment on column public.listings.free_finalize_used is
  'true once this listing has consumed its one free finalization — set once, never cleared, so a later re-finalization after a paid re-open correctly costs a credit instead of being free again.';

-- ============================================================
-- 2. agents — one row per agent phone number, credits + subscription
--    shared across every listing that phone owns.
-- ============================================================
create table if not exists public.agents (
  phone_normalized    text primary key,
  package_credits     integer not null default 0 check (package_credits >= 0),
  -- A date, not a plain boolean: subscriptions expire on their own on
  -- renewal day without needing a second write to flip a flag off.
  -- "Unlimited is active" = subscription_until is not null and in the future.
  subscription_until  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

alter table public.agents enable row level security;
revoke all on public.agents from anon, authenticated;
-- No policies, no public RPC: every read/write goes through server.js with
-- the service_role key, same lockdown as listings/phone_whitelist/phone_claims.
