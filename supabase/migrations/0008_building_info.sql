-- Быстросайт — "О доме / ЖК" slide fields.
-- Run once in the Supabase SQL Editor, after 0001-0007.
--
-- All optional/nullable, same convention as extra_features/nearby: a
-- listing that leaves every one of these blank simply never gets the
-- "О доме" slide (see buildingShown in js/deck.js buildSlides()).
alter table public.listings add column if not exists complex_name    text;
alter table public.listings add column if not exists build_year     int;
alter table public.listings add column if not exists building_class text;
alter table public.listings add column if not exists building_floors int;
alter table public.listings add column if not exists elevators      text;
alter table public.listings add column if not exists parking        text;
alter table public.listings add column if not exists infrastructure text;
