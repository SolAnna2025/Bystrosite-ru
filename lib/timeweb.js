/* ============================================================
   Быстросайт — Timeweb Cloud Postgres (Moscow region) client.
   Holds only agent phone-number data (whitelist, wallet/credits,
   subscription, free-finalize flag) — the one thing 152-ФЗ data
   localization actually gates. Everything else (listing content:
   photos, description, price...) stays in Supabase, which never sees
   a phone number once this is configured (see server.js).

   Unlike Supabase there is no PostgREST/anon-key layer in front of this
   database — it's a plain Postgres instance nothing but this server ever
   connects to, using a real DB user/password. No RLS story is needed for
   that reason: the whole DB is already private by not exposing a public
   API, not by policy.

   Configured via env vars (set on Render, never committed):
     TIMEWEB_DB_HOST, TIMEWEB_DB_PORT (default 5432), TIMEWEB_DB_NAME,
     TIMEWEB_DB_USER, TIMEWEB_DB_PASSWORD, TIMEWEB_DB_SSL (default "true")
   Until TIMEWEB_DB_HOST is set, configured() returns false and every
   caller in server.js falls back to its pre-Timeweb Supabase-only
   behavior — so deploying this file changes nothing until credentials
   are actually added.
   ============================================================ */
const { Pool } = require('pg');

const TIMEWEB_DB_HOST = process.env.TIMEWEB_DB_HOST || '';
const TIMEWEB_DB_PORT = process.env.TIMEWEB_DB_PORT || '5432';
const TIMEWEB_DB_NAME = process.env.TIMEWEB_DB_NAME || '';
const TIMEWEB_DB_USER = process.env.TIMEWEB_DB_USER || '';
const TIMEWEB_DB_PASSWORD = process.env.TIMEWEB_DB_PASSWORD || '';
const TIMEWEB_DB_SSL = process.env.TIMEWEB_DB_SSL !== 'false';

let pool = null;

function configured() {
  return !!(TIMEWEB_DB_HOST && TIMEWEB_DB_NAME && TIMEWEB_DB_USER && TIMEWEB_DB_PASSWORD);
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: TIMEWEB_DB_HOST,
      port: Number(TIMEWEB_DB_PORT),
      database: TIMEWEB_DB_NAME,
      user: TIMEWEB_DB_USER,
      password: TIMEWEB_DB_PASSWORD,
      ssl: TIMEWEB_DB_SSL ? { rejectUnauthorized: false } : false,
      max: 5,
    });
    pool.on('error', function (e) {
      // A dropped idle connection shouldn't crash the whole Node process —
      // pg's Pool emits 'error' on those instead of throwing where nothing
      // could catch it.
      console.error('Timeweb pool error:', e);
    });
  }
  return pool;
}

function query(text, params) {
  if (!configured()) return Promise.reject(new Error('Timeweb is not configured (set TIMEWEB_DB_HOST/NAME/USER/PASSWORD)'));
  return getPool().query(text, params);
}

module.exports = { configured, query };
