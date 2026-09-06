-- Быстросайт — replace direct phone storage with a Timeweb agent_id link.
-- Run once in the Supabase SQL Editor, after 0001-0006.
--
-- Context: 152-ФЗ data-localization steers the agent's phone number itself
-- into a Postgres instance on Timeweb Cloud (Moscow) — see
-- timeweb/migrations/0001_init.sql and lib/timeweb.js. From the moment
-- server.js has TIMEWEB_DB_* env vars set, every *new* listing (and every
-- listing an agent re-saves through the form) stores agent_id here instead
-- of a raw phone number; the public presentation page's phone display and
-- every finalize/credits/whitelist check are resolved server-side by
-- joining this to Timeweb's agents table (server.js, handlePublicListingView
-- and the billing helpers). Until TIMEWEB_DB_HOST is actually set, nothing
-- about this migration changes current behavior — server.js keeps writing
-- agent_phone exactly as before.
--
-- This migration is purely additive/non-destructive:
--   - agent_id is a new, nullable column — existing rows get NULL, and
--     nothing here reads or migrates their existing agent_phone value.
--   - agent_phone's NOT NULL constraint is dropped (loosened, not removed)
--     so a listing saved once Timeweb is live can omit it — the column
--     itself, and every currently-stored phone number in it, is left
--     completely untouched.
--   - get_listing_by_id() is no longer the public read path (server.js
--     now reads the row directly with the service_role key and merges in
--     the phone from Timeweb — see handlePublicListingView) — its
--     anon/authenticated EXECUTE grant is revoked since anon calling it
--     directly would only ever see a stale/incomplete row (no phone) from
--     here on. The function itself is left in place rather than dropped;
--     it's inert without that grant.
--
-- Backfilling agent_id for listings that already exist (and clearing their
-- stored agent_phone once that's done) is a separate, explicit step — run
-- only after you confirm it, since it touches real production data.

alter table public.listings add column if not exists agent_id uuid;

comment on column public.listings.agent_id is
  'References agents.agent_id in the Timeweb Cloud database (Moscow) — no FK, cross-database. Null for listings created before Timeweb was configured, or if it still isn''t; those keep using agent_phone directly (see server.js billingKeyForRow / ensureAgentByPhone).';

alter table public.listings alter column agent_phone drop not null;

comment on column public.listings.agent_phone is
  'Legacy: the agent''s raw phone number, stored directly. New rows saved once TIMEWEB_DB_HOST is configured leave this null and use agent_id instead (see lib/timeweb.js). Existing rows keep whatever value they already have until you separately confirm a backfill+cleanup.';

revoke execute on function public.get_listing_by_id(uuid) from anon, authenticated;
