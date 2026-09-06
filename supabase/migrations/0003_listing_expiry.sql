-- Быстросайт — 30-day free-listing expiry.
-- Run once in the Supabase SQL Editor, after 0001_init.sql and
-- 0002_finalize_and_credits.sql.
--
-- Rule: a listing created on the free tier expires 30 days after
-- creation. Expiry stops applying — permanently, from that moment on —
-- the instant the listing is finalized through a spent wallet credit
-- (paid_via_credit). It also never applies at all, for as long as it's
-- true, when the owning phone has an active "Безлимит" subscription or is
-- whitelisted — checked live at view time, not baked into the stored
-- expires_at, so buying Безлимит later retroactively un-expires every
-- listing that phone already has, with no need to touch their old rows.
--
-- expires_at itself is set once, at creation (server.js handleCreateListing),
-- for a non-unlimited phone; left null for an unlimited one (never expires
-- to begin with). paid_via_credit is set once a credit is actually spent
-- finalizing this listing (server.js handleListingFinalize).

alter table public.listings add column if not exists expires_at timestamptz;
alter table public.listings add column if not exists paid_via_credit boolean not null default false;

comment on column public.listings.expires_at is
  'Free-tier listings only: created_at + 30 days, set at creation. Null = never expires (agent was already unlimited at creation, or a credit has since been spent on this listing — see paid_via_credit). Whether an expired listing is actually blocked is re-derived live in get_listing_by_id(), not read directly off this column, so a later Безлимит purchase retroactively un-expires it.';
comment on column public.listings.paid_via_credit is
  'true once a package credit has been spent finalizing this specific listing (server.js handleListingFinalize) — makes it permanent regardless of expires_at, from that point on.';

-- ============================================================
-- get_listing_by_id: now also resolves whether the listing is currently
-- expired, using live agent status (phone_whitelist / agents.subscription_until)
-- — a plain client-side check couldn't do this without also exposing
-- agents (locked down, no public RPC, on purpose). Return type changes
-- from "setof listings" (an array of rows) to a single jsonb value — the
-- listing's own columns plus is_expired — since a computed field can't be
-- tacked onto a strict listings-row return type. js/app.js's
-- loadListingFromServer() was updated to match (a bare object/null instead
-- of an array of rows). Postgres won't let create-or-replace change a
-- function's return type in place (42P13) — drop it first.
drop function if exists public.get_listing_by_id(uuid);
create function public.get_listing_by_id(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.listings%rowtype;
  phone_key text;
  is_unlimited boolean;
begin
  select * into l from public.listings where id = p_id;
  if not found then
    return null;
  end if;

  phone_key := right(regexp_replace(coalesce(l.agent_phone, ''), '\D', '', 'g'), 10);

  select
    exists (select 1 from public.phone_whitelist w where w.phone_normalized = phone_key)
    or exists (
      select 1 from public.agents a
      where a.phone_normalized = phone_key
        and a.subscription_until is not null
        and a.subscription_until > now()
    )
  into is_unlimited;

  return to_jsonb(l) || jsonb_build_object(
    'is_expired',
    l.expires_at is not null
      and l.expires_at < now()
      and not l.paid_via_credit
      and not is_unlimited
  );
end;
$$;

grant execute on function public.get_listing_by_id(uuid) to anon, authenticated;
