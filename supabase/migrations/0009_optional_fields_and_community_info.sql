-- Быстросайт — the /new-listing form now only truly requires title, agent
-- name, agent phone, one of sale/rent price, and consent (see js/app.js's
-- REQUIRED_FIELD_IDS and server.js's REQUIRED_LISTING_FIELDS). Everything
-- below was still NOT NULL from 0001_init.sql, which would reject an empty
-- value at the database level even though the form and API now allow it.
alter table public.listings alter column location_name drop not null;
alter table public.listings alter column lat drop not null;
alter table public.listings alter column lng drop not null;
alter table public.listings alter column house_area drop not null;
alter table public.listings alter column bedrooms drop not null;
alter table public.listings alter column bathrooms drop not null;

-- "Информация о посёлке" (villa/house) / "Информация о ЖК" (apartment) —
-- a single optional textarea that toggles with property type, same pattern
-- as floors/floor_number. Rendered on the "Пространство для жизни" slide,
-- right after "Дополнительные преимущества" (see js/deck.js slideLiving).
alter table public.listings add column if not exists community_info text;
alter table public.listings add column if not exists building_info text;
