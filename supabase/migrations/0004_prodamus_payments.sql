-- Быстросайт — Prodamus (payform.ru) webhook payments.
-- Run once in the Supabase SQL Editor, after 0003_listing_expiry.sql.
--
-- One row per successfully processed payform webhook, keyed by our own
-- order_num (bsp-<plan>-<phone>-<timestamp>, set when the pay link is
-- built — see buildProdamusPayUrl in server.js). Payform can and does
-- resend the same successful-payment notification more than once; this
-- table is what turns a resend into a no-op instead of double-crediting
-- the agent's wallet — processProdamusPayment() inserts here first and
-- only credits agents if that insert actually succeeds (a duplicate
-- order_num hits the primary key and fails with 409).
create table if not exists public.payments (
  order_num         text primary key,
  phone_normalized  text not null,
  plan              text not null,
  sum               numeric,
  created_at        timestamptz not null default now()
);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
-- No policies, no public RPC: same lockdown as agents/listings — only
-- server.js (service_role key) ever touches this table.
