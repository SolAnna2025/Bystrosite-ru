-- Быстросайт — "страна объекта" (property country), an open free-text field
-- (not a fixed enum — the form's #fCountry is a text input with a <datalist>
-- of suggestions, not a <select>). Optional, same as location_name/lat/lng.
-- Drives which map provider js/deck.js's slideLocation embeds (Yandex for
-- Russia or unset, Google otherwise) and, server-side, which static-map
-- provider handleStaticMap tries first for the exported PDF (see server.js
-- isRussiaCountry()).
alter table public.listings add column if not exists country text;
