-- Быстросайт — move the "one free finalization" limit from per-listing to
-- per-phone-number, matching what /pricing has always promised
-- ("Первая презентация с этим номером телефона уже была создана бесплатно").
-- Run once in the Supabase SQL Editor, after 0001-0005.
--
-- listings.free_finalize_used (0002_finalize_and_credits.sql) tracks
-- whether *that one listing* has used its free finalize — but since every
-- brand-new listing starts with that column false, an agent could get an
-- unlimited number of free finalizations just by creating a fresh listing
-- each time instead of reopening an old one. This column moves the actual
-- gate to the phone number: server.js now checks agents.free_finalize_used
-- (via getAgentFreeFinalizeUsed) instead of listings.free_finalize_used
-- when deciding whether a listing's first finalize is free.
-- listings.free_finalize_used is left in place — still set for
-- informational/debugging purposes, just no longer read for the gate.
alter table public.agents add column if not exists free_finalize_used boolean not null default false;

comment on column public.agents.free_finalize_used is
  'true once this phone number has used its one free finalization, on any listing, ever. Checked instead of listings.free_finalize_used when deciding whether a listing''s first finalize is free.';

-- Backfill: a phone number that already finalized any listing for free
-- under the old per-listing model already had their one free finalize —
-- carry that forward so they don't get a second one on their next new
-- listing. agent_phone on listings is stored as typed (not normalized), so
-- normalize it here the same way normalizePhone() does in server.js:
-- strip non-digits, keep the last 10.
insert into public.agents (phone_normalized, free_finalize_used)
select distinct right(regexp_replace(agent_phone, '\D', '', 'g'), 10), true
from public.listings
where free_finalize_used = true
  and agent_phone is not null
  and length(right(regexp_replace(agent_phone, '\D', '', 'g'), 10)) = 10
on conflict (phone_normalized) do update set free_finalize_used = true;
