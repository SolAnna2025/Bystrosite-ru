-- Быстросайт — secret edit-token, closing the phone-reuse hole.
-- Run once in the Supabase SQL Editor, after 0001-0009.
--
-- Problem: a listing's "owner" has only ever been proven by "knows its
-- agent_phone" (server.js handleListingEditAuth) — but agent_phone is also
-- the number printed on the presentation's own contact slide (js/deck.js
-- slideFinal), so every client who receives a /p/<id> link already has
-- everything needed to open /edit/<id> and rewrite the listing. edit_token
-- is a second, private secret that's never rendered anywhere public — only
-- handed back to the agent's own browser (as /edit/<id>?t=<token>) at
-- creation time, or the moment a legacy (pre-this-migration) listing is
-- first authenticated by phone — see server.js handleListingEditAuth and
-- handleCreateListing, both updated alongside this migration.
--
-- Existing rows are left with edit_token = null on purpose: there's no
-- login system to deliver a freshly minted secret to an agent who isn't
-- currently looking at their own /edit/<id> tab, so those rows keep
-- falling back to the (weaker) phone check until their real owner next
-- authenticates — which is also the moment they get upgraded.

alter table public.listings add column if not exists edit_token text;

comment on column public.listings.edit_token is
  'Secret proof-of-ownership for /edit/<id>, replacing agent_phone (which is public — printed on the presentation itself). Set at creation for new listings, or opportunistically backfilled the first time a legacy row is authenticated by phone (server.js handleListingEditAuth). Never sent to the browser by handlePublicListingView, and stripped below from get_listing_by_id for the same reason.';

-- get_listing_by_id (0003_listing_expiry.sql) does `to_jsonb(l)`, which
-- would otherwise hand this secret to anyone who calls the RPC directly
-- with the anon key (public, in js/supabase-config.js) and a listing id
-- (also public — it's the id in every /p/<id> link) — exactly the class of
-- leak the 0005 migration's own comment already called out for a
-- hypothetical secret column. Strip it explicitly; nothing else here
-- changes from 0003's version.
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

  return (to_jsonb(l) - 'edit_token') || jsonb_build_object(
    'is_expired',
    l.expires_at is not null
      and l.expires_at < now()
      and not l.paid_via_credit
      and not is_unlimited
  );
end;
$$;

grant execute on function public.get_listing_by_id(uuid) to anon, authenticated;
