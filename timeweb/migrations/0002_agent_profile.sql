-- Быстросайт — add agent name + headshot photo to Timeweb, next to phone.
-- Run once against the Timeweb database (same one 0001_init.sql ran on).
--
-- Name and photo are personal data of the same natural person whose phone
-- number already lives here (see 0001_init.sql) — 152-ФЗ localization
-- doesn't stop at the phone digit, so this keeps the rest of an agent's own
-- personal data out of Supabase too instead of leaving it split across two
-- databases. photo is a plain bytea: the client (see resizeImageCapped in
-- js/app.js) caps every upload to a small JPEG specifically so this never
-- becomes a real-sized-blob-in-Postgres problem.
alter table public.agents add column if not exists name text;
alter table public.agents add column if not exists photo bytea;
alter table public.agents add column if not exists photo_mime text;
