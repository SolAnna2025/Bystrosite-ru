-- Быстросайт — presentation language + edit-access hardening.
-- Run once in the Supabase SQL Editor, after 0001-0004.
--
-- 1. language: which dictionary (ru/en, see js/i18n.js) the web view and the
--    PDF export render this listing in. Set exactly once, at creation
--    (server.js handleCreateListing — never touched by an update), from
--    whatever language the agent had selected in the UI at that moment.
--    Never re-derived from the viewer's browser locale — that was the bug:
--    a shared link used to render in *the visitor's own* language setting
--    instead of the language the agent actually built the presentation in.
--    Existing rows predate this column and get the same 'ru' default old
--    behavior effectively always assumed.
alter table public.listings add column if not exists language text not null default 'ru';

comment on column public.listings.language is
  'ru or en — fixed once at creation from the agent''s UI language (js/i18n.js). The web view and PDF export both render in this language regardless of the current viewer''s browser locale. Never changed by an edit.';

-- get_listing_by_id (0003_listing_expiry.sql) already does `to_jsonb(l)`,
-- so this new column is exposed to the public read path automatically —
-- no function change needed here. (Contrast with a would-be secret column,
-- which to_jsonb(l) would also leak — there isn't one added by this
-- migration.)
