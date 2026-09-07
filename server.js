const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const timeweb = require('./lib/timeweb');

const root = __dirname;
// Render/Railway/etc. assign the listening port at runtime via $PORT and
// route their public URL to whatever that is — 8642 only survives as the
// local-dev fallback.
const port = process.env.PORT || 8642;

// dist/ (npm run build — see scripts/build.js) holds minified+mangled
// copies of every project .js/.css file, mirroring the source tree. Local
// `node server.js` without ever running the build works exactly as before
// (dist/ absent -> every request falls through to the root); a deploy that
// ran the build serves the minified versions automatically, with no other
// code change needed since index.html's relative paths are identical
// either way. Only .js/.css get built, so index.html/privacy.html/assets/
// always come from the root regardless.
const distDir = path.join(root, 'dist');
const distAvailable = fs.existsSync(distDir);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
};

/* ---------------- Supabase (server-side only) ----------------
   The service_role key bypasses RLS by design — that's exactly why it must
   never reach the browser (js/app.js only ever gets the anon/publishable
   key, via js/supabase-config.js). Set these two as real environment
   variables before starting the server; until they're set, every Supabase
   feature below fails open into its pre-Supabase local behavior instead of
   hard-erroring, so `node server.js` still works for local demoing. */
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = 'bystrosite';

function supabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseRest(pathSuffix, options) {
  options = options || {};
  const headers = Object.assign({
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  }, options.headers || {});
  return fetch(SUPABASE_URL + '/rest/v1' + pathSuffix, Object.assign({}, options, { headers }));
}

function supabaseStorageUpload(objectPath, buffer, contentType) {
  return fetch(SUPABASE_URL + '/storage/v1/object/' + SUPABASE_BUCKET + '/' + objectPath, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });
}

/* ---------------- Static map proxy (PDF export) ----------------
   The Location slide's live map is a Yandex Maps iframe (js/deck.js
   slideLocation) — cross-origin, so html2canvas can't rasterize it into
   the exported PDF at all (see the comment above captureSlideToJpeg).
   generatePdf() swaps it for a static map image for the duration of that
   one slide's capture instead of the old text-only fallback. The key
   stays server-side and gets called through this same-origin proxy for
   two reasons: (1) a Static Maps key doesn't need to be embedded in the
   frontend bundle at all, unlike a JS-API key that must run in the
   browser; (2) none of these providers' static-map responses carry CORS
   headers, which would make html2canvas's canvas capture of that image
   taint/fail if the browser loaded it cross-origin directly. */
const YANDEX_STATIC_MAPS_API_KEY = process.env.YANDEX_STATIC_MAPS_API_KEY || '';
// Yandex first — same provider as the live map above, so the PDF's map
// matches what the agent saw on screen. Geoapify's free tier (just an
// email, no billing card) is the fallback if no Yandex key is configured.
// GOOGLE_MAPS_API_KEY is legacy — only used if neither of the above is
// set, kept for deploys that already had it configured.
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

function pipeMapImage(res, mapUrl) {
  fetch(mapUrl).then(function (mapRes) {
    if (!mapRes.ok) { res.writeHead(502); res.end(); return; }
    return mapRes.arrayBuffer().then(function (buf) {
      res.writeHead(200, {
        'Content-Type': mapRes.headers.get('content-type') || 'image/png',
        // A location's static map never changes — safe to cache for a while,
        // both in the browser and on repeat PDF exports of the same listing.
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(Buffer.from(buf));
    });
  }).catch(function (e) {
    console.error('static-map proxy failed:', e);
    res.writeHead(502); res.end();
  });
}

function handleStaticMap(req, res) {
  const query = new URL(req.url, 'http://localhost').searchParams;
  const lat = Number(query.get('lat'));
  const lng = Number(query.get('lng'));
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!valid) { res.writeHead(404); res.end(); return; }

  if (YANDEX_STATIC_MAPS_API_KEY) {
    // Yandex's ll/pt params take lon,lat (reverse of how lat/lng are
    // stored everywhere else in this file) — see the same note in
    // js/deck.js slideLocation. 650x450 is the API's max size, so no
    // scale=2 equivalent is available here.
    pipeMapImage(res, 'https://static-maps.yandex.ru/1.x/'
      + '?ll=' + lng + ',' + lat
      + '&z=15&l=map&size=650,450'
      + '&pt=' + lng + ',' + lat + ',pm2rdl'
      + '&apikey=' + encodeURIComponent(YANDEX_STATIC_MAPS_API_KEY));
    return;
  }

  if (GEOAPIFY_API_KEY) {
    pipeMapImage(res, 'https://maps.geoapify.com/v1/staticmap'
      + '?style=osm-carto&width=640&height=640'
      + '&center=lonlat:' + lng + ',' + lat
      + '&zoom=15'
      + '&marker=lonlat:' + lng + ',' + lat + ';color:%232c2a22;size:large'
      + '&apiKey=' + encodeURIComponent(GEOAPIFY_API_KEY));
    return;
  }

  if (GOOGLE_MAPS_API_KEY) {
    pipeMapImage(res, 'https://maps.googleapis.com/maps/api/staticmap'
      + '?center=' + lat + ',' + lng
      + '&zoom=15&size=640x640&scale=2&maptype=roadmap'
      + '&markers=color:0x2c2a22%7C' + lat + ',' + lng
      + '&key=' + encodeURIComponent(GOOGLE_MAPS_API_KEY));
    return;
  }

  // No key configured — 404, so the client's img.onerror falls back to
  // the old text-only Location slide instead of a broken image.
  res.writeHead(404); res.end();
}

/* ---------------- Phone identity + finalize/credits model ----------------
   normalizePhone(): strip everything but digits, then keep only the last 10
   — so "+7 937 166-75-55", "89371667555" and "9371667555" all collapse to
   the same key regardless of how the 7/8/+7 prefix was written. This is the
   same rule the DB's listings.agent_phone_normalized generated column and
   phone_whitelist seed rows use (see supabase/migrations/0001_init.sql), so
   a phone matches the whitelist the same way here and there.

   The model (see supabase/migrations/0002_finalize_and_credits.sql):
   creating a listing is always free and unlimited. Editing one is free and
   unlimited too, right up until it's finalized (agent clicks "Поделиться
   презентацией" or "Скачать PDF" — see handleListingFinalize). Finalizing
   locks that one listing (listings.is_finalized); each listing gets exactly
   one free finalization (listings.free_finalize_used), every one after that
   spends one credit from the agent's own wallet (agents.package_credits,
   shared across all of that phone's listings), unless an unlimited
   subscription is active, in which case a listing never locks at all.
   Credits/subscriptions are granted the same way is_paid/paid_tier already
   are — an admin confirms a payment (QR + Telegram, per /pricing) and
   updates the agents row by hand in the Table Editor; there's no automated
   payment gateway here to wire up. */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/* Never log a full phone number or order_num (order_num embeds the phone's
   normalized digits — see buildProdamusPayUrl) anywhere in this file.
   Platform logs (Render's included) are themselves outside Russia, and
   avoiding exactly that kind of durable copy of a phone number leaving the
   country is the whole point of the Timeweb split above — masked to the
   last 4 digits, which is enough to eyeball/correlate log lines by hand
   without it being a usable phone number. */
function maskPhone(phone) {
  var s = String(phone || '');
  return s.length >= 4 ? '***' + s.slice(-4) : '***';
}
function maskOrderNum(orderNum) {
  return String(orderNum || '').replace(/\d{10}/, function (d) { return '***' + d.slice(-4); });
}

/* ---------------- Legacy (Supabase agents table) implementations ----------
   Unchanged logic from before the Timeweb split — still exactly what runs
   whenever TIMEWEB_DB_HOST isn't set, and the per-row fallback for any
   listing that predates it (no agent_id). See billingKeyForRow() and the
   tw*ById variants below for the Timeweb-backed replacements. */
async function sbIsAgentUnlimited(normalized) {
  if (!normalized) return false;
  const wl = await supabaseRest('/phone_whitelist?phone_normalized=eq.' + encodeURIComponent(normalized) + '&select=phone_normalized');
  if (wl.ok && (await wl.json()).length) return true;
  const agent = await supabaseRest('/agents?phone_normalized=eq.' + encodeURIComponent(normalized) + '&select=subscription_until');
  if (agent.ok) {
    const rows = await agent.json();
    if (rows.length && rows[0].subscription_until && new Date(rows[0].subscription_until) > new Date()) return true;
  }
  return false;
}

async function sbGetAgentCredits(normalized) {
  if (!normalized) return 0;
  const res = await supabaseRest('/agents?phone_normalized=eq.' + encodeURIComponent(normalized) + '&select=package_credits');
  if (!res.ok) return 0;
  const rows = await res.json();
  return rows.length ? (rows[0].package_credits || 0) : 0;
}

async function sbSpendAgentCredit(normalized, currentCredits) {
  const res = await supabaseRest(
    '/agents?phone_normalized=eq.' + encodeURIComponent(normalized) + '&package_credits=eq.' + currentCredits,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ package_credits: currentCredits - 1 }) }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

async function sbGetAgentFreeFinalizeUsed(normalized) {
  if (!normalized) return false;
  const res = await supabaseRest('/agents?phone_normalized=eq.' + encodeURIComponent(normalized) + '&select=free_finalize_used');
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length ? !!rows[0].free_finalize_used : false;
}

async function sbClaimAgentFreeFinalize(normalized) {
  const upd = await supabaseRest(
    '/agents?phone_normalized=eq.' + encodeURIComponent(normalized) + '&free_finalize_used=eq.false',
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ free_finalize_used: true }) }
  );
  if (upd.ok) {
    const rows = await upd.json();
    if (rows.length) return true;
  }
  const ins = await supabaseRest('/agents', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ phone_normalized: normalized, free_finalize_used: true }),
  });
  if (!ins.ok) return false;
  const insRows = await ins.json();
  return insRows.length > 0;
}

/* ---------------- Timeweb (Moscow) implementations ----------------
   Same semantics as the sb* functions above, backed by lib/timeweb.js
   instead of the Supabase REST API. A real SQL connection makes the
   optimistic-concurrency dance PostgREST needed (read, then a
   conditional PATCH whose WHERE clause re-checks the value just read)
   unnecessary — a single UPDATE...RETURNING is already atomic. */
async function twIsAgentUnlimitedByPhone(normalized) {
  if (!normalized) return false;
  const wl = await timeweb.query('select 1 from phone_whitelist where phone_normalized = $1', [normalized]);
  if (wl.rows.length) return true;
  const agent = await timeweb.query('select subscription_until from agents where phone_normalized = $1', [normalized]);
  return !!(agent.rows.length && agent.rows[0].subscription_until && new Date(agent.rows[0].subscription_until) > new Date());
}

async function twIsAgentUnlimitedById(agentId) {
  const wl = await timeweb.query(
    'select 1 from phone_whitelist w join agents a on a.phone_normalized = w.phone_normalized where a.agent_id = $1',
    [agentId]
  );
  if (wl.rows.length) return true;
  const agent = await timeweb.query('select subscription_until from agents where agent_id = $1', [agentId]);
  return !!(agent.rows.length && agent.rows[0].subscription_until && new Date(agent.rows[0].subscription_until) > new Date());
}

async function twGetAgentCreditsByPhone(normalized) {
  if (!normalized) return 0;
  const res = await timeweb.query('select package_credits from agents where phone_normalized = $1', [normalized]);
  return res.rows.length ? (res.rows[0].package_credits || 0) : 0;
}

async function twGetAgentCreditsById(agentId) {
  const res = await timeweb.query('select package_credits from agents where agent_id = $1', [agentId]);
  return res.rows.length ? (res.rows[0].package_credits || 0) : 0;
}

async function twSpendAgentCreditByPhone(normalized, currentCredits) {
  const res = await timeweb.query(
    'update agents set package_credits = package_credits - 1 where phone_normalized = $1 and package_credits = $2 returning agent_id',
    [normalized, currentCredits]
  );
  return res.rows.length > 0;
}

async function twSpendAgentCreditById(agentId, currentCredits) {
  const res = await timeweb.query(
    'update agents set package_credits = package_credits - 1 where agent_id = $1 and package_credits = $2 returning agent_id',
    [agentId, currentCredits]
  );
  return res.rows.length > 0;
}

async function twGetAgentFreeFinalizeUsedByPhone(normalized) {
  if (!normalized) return false;
  const res = await timeweb.query('select free_finalize_used from agents where phone_normalized = $1', [normalized]);
  return res.rows.length ? !!res.rows[0].free_finalize_used : false;
}

async function twGetAgentFreeFinalizeUsedById(agentId) {
  const res = await timeweb.query('select free_finalize_used from agents where agent_id = $1', [agentId]);
  return res.rows.length ? !!res.rows[0].free_finalize_used : false;
}

/* Upsert-based claim: one statement either flips a fresh (or still-false)
   row's free_finalize_used to true and returns it, or — if a concurrent
   caller already claimed it — updates nothing and the WHERE clause in the
   RETURNING-guarded UPDATE below reports that by returning zero rows.
   ON CONFLICT targets the same unique index a plain phone-based insert
   would use, so two brand-new claims racing each other still only let one
   through, same guarantee sbClaimAgentFreeFinalize had via
   resolution=ignore-duplicates. */
async function twClaimAgentFreeFinalizeByPhone(normalized, phoneDisplay) {
  const ins = await timeweb.query(
    `insert into agents (phone, free_finalize_used) values ($1, true)
     on conflict (phone_normalized) do update
       set free_finalize_used = true
       where agents.free_finalize_used = false
     returning agent_id`,
    [phoneDisplay || normalized]
  );
  return ins.rows.length > 0;
}

async function twClaimAgentFreeFinalizeById(agentId) {
  const res = await timeweb.query(
    'update agents set free_finalize_used = true where agent_id = $1 and free_finalize_used = false returning agent_id',
    [agentId]
  );
  return res.rows.length > 0;
}

/* Finds an existing agent by phone — never creates one. Used wherever a
   wrong guess must fail closed instead of silently creating a junk row
   (edit-auth, the "does the submitted phone still own this listing"
   check) — see handleListingEditAuth / handleCreateListing. */
async function twFindAgentIdByPhone(normalized) {
  if (!normalized) return null;
  const res = await timeweb.query('select agent_id from agents where phone_normalized = $1', [normalized]);
  return res.rows.length ? res.rows[0].agent_id : null;
}

/* Finds-or-creates the agents row for this phone, keeping `phone` (the
   raw, as-typed display string — shown to buyers on the presentation
   page, see handlePublicListingView) in sync with whatever was most
   recently typed. This is the one place a brand-new agent identity is
   meant to come into existence. */
async function ensureAgentByPhone(normalized, phoneDisplay) {
  const res = await timeweb.query(
    `insert into agents (phone) values ($1)
     on conflict (phone_normalized) do update set phone = excluded.phone
     returning agent_id`,
    [phoneDisplay || normalized]
  );
  return res.rows[0].agent_id;
}

async function twGetAgentPhoneDisplay(agentId) {
  const res = await timeweb.query('select phone from agents where agent_id = $1', [agentId]);
  return res.rows.length ? res.rows[0].phone : null;
}

/* Agent name + headshot photo (152-ФЗ personal data of the same person
   whose phone lives here) — see timeweb/migrations/0002_agent_profile.sql.
   Always overwrites both with whatever the form just submitted rather than
   only updating when "changed": unlike the villa/logo/QR photos elsewhere
   in this file, the client never round-trips this one as a Storage URL —
   loadListingFromServer (js/app.js) gets it back as the same data: URL
   twGetAgentProfile below hands it, so a resubmit that didn't touch the
   photo still arrives here as that identical data: URL, indistinguishable
   from "just re-uploaded the exact same photo". photoBuffer/photoMime are
   null when the agent removed their photo (or never set one). */
async function twSetAgentProfile(agentId, name, photoBuffer, photoMime) {
  await timeweb.query(
    'update agents set name = $2, photo = $3, photo_mime = $4 where agent_id = $1',
    [agentId, name || null, photoBuffer || null, photoBuffer ? (photoMime || null) : null]
  );
}

async function twGetAgentProfile(agentId) {
  const res = await timeweb.query('select name, photo, photo_mime from agents where agent_id = $1', [agentId]);
  if (!res.rows.length) return { name: null, photoDataUrl: null };
  const row = res.rows[0];
  return {
    name: row.name,
    photoDataUrl: row.photo ? ('data:' + (row.photo_mime || 'image/jpeg') + ';base64,' + row.photo.toString('base64')) : null,
  };
}

/* ---------------- Dispatchers ----------------
   Every call site below builds a key describing how it knows this
   listing's owning agent — makeKey(phoneFromRow, row.agent_id) — and
   these pick the right backend:
     - Timeweb configured + an agent_id is known: query Timeweb by id
       (the row itself never has to carry a phone number at all anymore).
     - Timeweb configured but only a phone is known (a brand-new
       submission, or a legacy row with no agent_id yet): query Timeweb
       by phone.
     - Timeweb not configured at all: the original Supabase-agents-table
       behavior, unchanged. */
function makeKey(phoneNormalized, agentId) {
  return { phone: phoneNormalized || null, agentId: agentId || null };
}

async function isAgentUnlimited(key) {
  if (timeweb.configured()) {
    if (key.agentId) return twIsAgentUnlimitedById(key.agentId);
    return twIsAgentUnlimitedByPhone(key.phone);
  }
  return sbIsAgentUnlimited(key.phone);
}

async function getAgentCredits(key) {
  if (timeweb.configured()) {
    if (key.agentId) return twGetAgentCreditsById(key.agentId);
    return twGetAgentCreditsByPhone(key.phone);
  }
  return sbGetAgentCredits(key.phone);
}

async function spendAgentCredit(key, currentCredits) {
  if (timeweb.configured()) {
    if (key.agentId) return twSpendAgentCreditById(key.agentId, currentCredits);
    return twSpendAgentCreditByPhone(key.phone, currentCredits);
  }
  return sbSpendAgentCredit(key.phone, currentCredits);
}

async function getAgentFreeFinalizeUsed(key) {
  if (timeweb.configured()) {
    if (key.agentId) return twGetAgentFreeFinalizeUsedById(key.agentId);
    return twGetAgentFreeFinalizeUsedByPhone(key.phone);
  }
  return sbGetAgentFreeFinalizeUsed(key.phone);
}

async function claimAgentFreeFinalize(key, phoneDisplay) {
  if (timeweb.configured()) {
    if (key.agentId) return twClaimAgentFreeFinalizeById(key.agentId);
    return twClaimAgentFreeFinalizeByPhone(key.phone, phoneDisplay);
  }
  return sbClaimAgentFreeFinalize(key.phone);
}

/* ---------------- Prodamus (payform.ru) payments ----------------
   Replaces the old "fixed QR + Telegram, admin edits the agents row by
   hand" flow above with a real gateway: /api/pricing/pay asks payform.ru
   for a checkout link for one plan + phone, and payform's own webhook
   (/api/prodamus-webhook) credits that phone's agents row automatically
   once it's actually paid. Two things must be set up in the payform
   cabinet for this to work at all: a secret key (PRODAMUS_SECRET_KEY
   below) and the notification URL pointed at
   https://<this server>/api/prodamus-webhook. Reference docs:
   https://help.prodamus.ru/payform/integracii/rest-api — the exact
   signing algorithm below was cross-checked against the reference
   implementation at https://github.com/dnagikh/python-prodamus, since
   Prodamus's own docs don't spell out the JSON-canonicalization step. */
const PRODAMUS_DOMAIN = 'proffbroker.payform.ru';
const PRODAMUS_SECRET_KEY = process.env.PRODAMUS_SECRET_KEY || '';

const PRICING_PLANS = {
  single: { name: 'Разовая презентация', price: 250, credits: 1 },
  pack5: { name: '5 презентаций', price: 1000, credits: 5 },
  pack20: { name: '20 презентаций', price: 3000, credits: 20 },
  unlimited: { name: 'Безлимит на 30 дней', price: 10000, subscriptionDays: 30 },
};

/* Prodamus signs both outgoing link params and incoming webhooks the same
   way: recursively sort every object's keys, compact-JSON-encode it (PHP's
   json_encode(..., sorted keys) equivalent — a JS object whose keys are
   exactly "0".."n-1" encodes as a JSON array, same as a PHP list would),
   then HMAC-SHA256-hex the result with the secret key. */
function prodamusStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(String(value));
  var keys = Object.keys(value);
  var isList = keys.every(function (k, i) { return k === String(i); });
  if (isList) return '[' + keys.map(function (k) { return prodamusStringify(value[k]); }).join(',') + ']';
  return '{' + keys.slice().sort().map(function (k) {
    return JSON.stringify(k) + ':' + prodamusStringify(value[k]);
  }).join(',') + '}';
}

function prodamusSign(obj) {
  return crypto.createHmac('sha256', PRODAMUS_SECRET_KEY).update(prodamusStringify(obj), 'utf8').digest('hex');
}

/* Turns payform's flat PHP-style webhook fields (order_num=..,
   products[0][name]=..) into the nested structure prodamusStringify()
   expects — mirrors PHP's own bracket-key parsing of $_POST. */
function setProdamusField(root, key, value) {
  var m = key.match(/^([^\[\]]+)((?:\[[^\]]*\])*)$/);
  if (!m) { root[key] = value; return; }
  var path = [m[1]];
  var re = /\[([^\]]*)\]/g, mm;
  while ((mm = re.exec(m[2]))) path.push(mm[1]);
  var node = root;
  for (var i = 0; i < path.length - 1; i++) {
    if (typeof node[path[i]] !== 'object' || node[path[i]] === null) node[path[i]] = {};
    node = node[path[i]];
  }
  node[path[path.length - 1]] = value;
}

function parseProdamusBody(raw, contentType) {
  var entries = [];
  var boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (boundaryMatch) {
    var boundary = boundaryMatch[1] || boundaryMatch[2];
    raw.split('--' + boundary).forEach(function (part) {
      var nameMatch = /name="([^"]+)"/i.exec(part);
      var sepIdx = part.indexOf('\r\n\r\n');
      if (!nameMatch || sepIdx === -1) return;
      var value = part.slice(sepIdx + 4).replace(/\r\n--?$/, '').replace(/\r\n$/, '');
      entries.push([nameMatch[1], value]);
    });
  } else {
    new URLSearchParams(raw).forEach(function (v, k) { entries.push([k, v]); });
  }
  var root = {};
  entries.forEach(function (pair) { setProdamusField(root, pair[0], pair[1]); });
  return root;
}

/* Builds a payform.ru checkout URL for one plan + phone. order_id is our
   own reference (payform echoes it back as order_num in the webhook) —
   encoding plan + phone directly into it means no extra "pending order"
   table is needed to know what to credit when the webhook comes back.

   No urlReturn/urlSuccess: this account's proffbroker.payform.ru rejects
   the request with a bare 400 the instant *either* field is present, for
   *any* URL value (even payform's own domain) — confirmed by testing, not
   a guess. Prodamus migrated this account to their newer "Prodamus.Pay"
   platform, which apparently requires a redirect domain to be registered
   somewhere first (their own manually-configured "Платёжные ссылки"
   product has a UI toggle for this; the classic do=pay REST endpoint used
   here has no equivalent field pointed at yet). Until Prodamus support
   clarifies how to register one for this endpoint, the agent lands on
   Prodamus's own generic success page after paying and returns to the
   site manually (browser back) — crediting itself doesn't depend on this
   at all, see processProdamusPayment. */
function buildProdamusPayUrl(planKey, phoneNormalized) {
  var plan = PRICING_PLANS[planKey];
  var orderId = 'bsp-' + planKey + '-' + phoneNormalized + '-' + Date.now();
  var params = {
    do: 'pay',
    order_id: orderId,
    customer_phone: '+7' + phoneNormalized,
    products: { 0: { name: plan.name, price: String(plan.price), quantity: '1' } },
  };
  params.signature = prodamusSign(params);

  var qs = [];
  function flatten(prefix, value) {
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) { flatten(prefix + '[' + k + ']', value[k]); });
    } else {
      qs.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(value));
    }
  }
  Object.keys(params).forEach(function (k) { flatten(k, params[k]); });
  return 'https://' + PRODAMUS_DOMAIN + '/?' + qs.join('&');
}

function handlePricingPay(req, res) {
  readJsonBody(req, 2e3, function (err, body) {
    if (err) { sendJson(res, 400, { error: 'bad request' }); return; }
    if (!PRODAMUS_SECRET_KEY) { sendJson(res, 501, { error: 'payments not configured' }); return; }
    var plan = body && PRICING_PLANS[body.plan];
    if (!plan) { sendJson(res, 400, { error: 'unknown plan' }); return; }
    var normalized = normalizePhone(body && body.phone);
    if (normalized.length !== 10) { sendJson(res, 400, { error: 'invalid phone' }); return; }

    // body.returnPath (js/app.js) is unused for now — see buildProdamusPayUrl
    // for why urlReturn/urlSuccess aren't sent at all currently.
    var url = buildProdamusPayUrl(body.plan, normalized);
    sendJson(res, 200, { url: url });
  });
}

/* Timeweb version of creditAgentPlan below: a single atomic upsert instead
   of a read-then-conditional-PATCH retry loop, since a real SQL connection
   doesn't need PostgREST's optimistic-concurrency dance to do a safe
   read-modify-write — Postgres's own row lock inside the UPDATE/INSERT
   statement already serializes two concurrent callers for the same phone. */
async function twCreditAgentPlan(phone, phoneDisplay, plan) {
  // `phone` is only ever set from the INSERT branch's value (a webhook only
  // ever carries the normalized digits, never how the agent originally
  // typed it) — deliberately left untouched on conflict so a payment never
  // clobbers a nicer display string the listing form already stored.
  if (plan.subscriptionDays) {
    await timeweb.query(
      `insert into agents (phone, subscription_until)
       values ($1, now() + ($2 || ' days')::interval)
       on conflict (phone_normalized) do update set
         subscription_until = (case
           when agents.subscription_until is not null and agents.subscription_until > now()
             then agents.subscription_until + ($2 || ' days')::interval
           else now() + ($2 || ' days')::interval
         end)`,
      [phoneDisplay || phone, plan.subscriptionDays]
    );
  } else {
    await timeweb.query(
      `insert into agents (phone, package_credits)
       values ($1, $2)
       on conflict (phone_normalized) do update set
         package_credits = agents.package_credits + $2`,
      [phoneDisplay || phone, plan.credits]
    );
  }
}

/* Grants one plan's credits/subscription-days to a phone's agents row.
   Used to be a plain "read package_credits/subscription_until, compute the
   new value, PATCH it" — which races the same way the pre-fix free-finalize
   check did: two webhook deliveries for two *different* orders on the same
   phone, close together (e.g. an agent buying two packs back to back), can
   both read the old value before either write lands, and the second write
   silently clobbers the first — one whole paid-for credit grant lost with
   no error anywhere. Retries a small, bounded number of times against an
   optimistic-concurrency PATCH (only succeeds if the row still matches
   what was just read — same technique as spendAgentCredit/
   claimAgentFreeFinalize) rather than trusting a single read to still be
   current by the time the write lands. Only the Supabase-fallback path
   (Timeweb not configured) still needs this retry loop — see
   twCreditAgentPlan above for the Timeweb version. */
async function sbCreditAgentPlan(phone, plan) {
  for (var attempt = 0; attempt < 5; attempt++) {
    const agentRes = await supabaseRest('/agents?phone_normalized=eq.' + encodeURIComponent(phone) + '&select=package_credits,subscription_until');
    const rows = agentRes.ok ? await agentRes.json() : [];
    const existing = rows.length ? rows[0] : null;

    var patch, matchFilter;
    if (plan.subscriptionDays) {
      var base = (existing && existing.subscription_until && new Date(existing.subscription_until) > new Date())
        ? new Date(existing.subscription_until) : new Date();
      base.setDate(base.getDate() + plan.subscriptionDays);
      patch = { subscription_until: base.toISOString() };
      matchFilter = '&subscription_until=' + (existing && existing.subscription_until
        ? 'eq.' + encodeURIComponent(existing.subscription_until) : 'is.null');
    } else {
      patch = { package_credits: (existing ? existing.package_credits || 0 : 0) + plan.credits };
      matchFilter = '&package_credits=eq.' + (existing ? existing.package_credits || 0 : 0);
    }

    if (existing) {
      const upd = await supabaseRest('/agents?phone_normalized=eq.' + encodeURIComponent(phone) + matchFilter, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (upd.ok) {
        const updRows = await upd.json();
        if (updRows.length) return; // landed cleanly against the row we just read
      }
      // Someone else updated this row between the read and the write above
      // — retry with a fresh read rather than silently losing this grant.
    } else {
      const ins = await supabaseRest('/agents', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(Object.assign({ phone_normalized: phone }, patch)),
      });
      if (ins.ok) {
        const insRows = await ins.json();
        if (insRows.length) return; // row didn't exist yet; this call created it
      }
      // Someone else created the row concurrently — retry; `existing` will
      // be found next time round and this becomes the PATCH branch.
    }
  }
  throw new Error('sbCreditAgentPlan: gave up after retries for phone ' + maskPhone(phone));
}

async function creditAgentPlan(phone, phoneDisplay, plan) {
  if (timeweb.configured()) return twCreditAgentPlan(phone, phoneDisplay, plan);
  return sbCreditAgentPlan(phone, plan);
}

/* Only ever called after the signature has already checked out — see
   handleProdamusWebhook. Idempotent: payform can (and does) resend the
   same successful-payment notification, and the payments-table insert
   below is what turns a resend into a no-op instead of double-crediting
   the agent's wallet. Once Timeweb is configured this dedup row (it holds
   the same phone_normalized as agents/phone_whitelist) is written there
   instead of Supabase — see timeweb/migrations/0001_init.sql. */
async function processProdamusPayment(nested) {
  var status = String(nested.payment_status || '').toLowerCase();
  var orderNum = String(nested.order_num || nested.order_id || '');
  console.log('prodamus webhook: order=' + maskOrderNum(orderNum) + ' status=' + status + ' sum=' + nested.sum);
  if (status !== 'success') return;

  var m = orderNum.match(/^bsp-(single|pack5|pack20|unlimited)-(\d{10})-\d+$/);
  if (!m) { console.error('prodamus webhook: unrecognized order_num', maskOrderNum(orderNum)); return; }
  var planKey = m[1], phone = m[2];
  var plan = PRICING_PLANS[planKey];

  if (timeweb.configured()) {
    try {
      await timeweb.query(
        'insert into payments (order_num, phone_normalized, plan, sum) values ($1, $2, $3, $4)',
        [orderNum, phone, planKey, nested.sum || null]
      );
    } catch (e) {
      if (e && e.code === '23505') { console.log('prodamus webhook: duplicate delivery, already credited:', maskOrderNum(orderNum)); return; }
      throw e;
    }
  } else {
    var insert = await supabaseRest('/payments', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ order_num: orderNum, phone_normalized: phone, plan: planKey, sum: nested.sum || null }),
    });
    if (!insert.ok) {
      if (insert.status === 409) { console.log('prodamus webhook: duplicate delivery, already credited:', maskOrderNum(orderNum)); return; }
      throw new Error('payments insert failed: ' + insert.status);
    }
  }

  await creditAgentPlan(phone, '+7' + phone, plan);
  console.log('prodamus webhook: credited phone=' + maskPhone(phone) + ' plan=' + planKey);
}

function handleProdamusWebhook(req, res) {
  var raw = '';
  var tooLarge = false;
  req.on('data', function (chunk) {
    raw += chunk;
    if (!tooLarge && raw.length > 1e6) { tooLarge = true; req.destroy(); }
  });
  req.on('end', function () {
    if (tooLarge) { res.writeHead(400); res.end(); return; }
    if (!PRODAMUS_SECRET_KEY) {
      console.error('prodamus webhook received but PRODAMUS_SECRET_KEY is not set — ignoring');
      res.writeHead(501); res.end(); return;
    }
    var nested = parseProdamusBody(raw, req.headers['content-type']);
    var receivedSign = String(req.headers['sign'] || '');
    var expectedSign = prodamusSign(nested);
    if (!receivedSign || expectedSign.toLowerCase() !== receivedSign.toLowerCase()) {
      console.warn('prodamus webhook: signature mismatch for order', maskOrderNum(nested.order_num), { expectedSign: expectedSign, receivedSign: receivedSign });
      res.writeHead(400); res.end(); return;
    }
    processProdamusPayment(nested).then(function () {
      res.writeHead(200); res.end('OK');
    }).catch(function (e) {
      // Signature was valid; the failure is on our side (e.g. Supabase
      // hiccup) — 200 anyway so payform doesn't retry forever on something
      // a retry won't fix. Logged loudly for manual follow-up.
      console.error('prodamus webhook processing failed for order', maskOrderNum(nested.order_num), e);
      res.writeHead(200); res.end('OK');
    });
  });
}

async function getListingRow(id) {
  const res = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id) + '&select=id,agent_phone,agent_id,is_finalized,free_finalize_used,photos,logo_path,agent_photo_path,agent_qr');
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? rows[0] : null;
}

/* This row's billing key, for isAgentUnlimited/getAgentCredits/etc above —
   prefers agent_id (Timeweb) whenever both Timeweb is configured and the
   row has one; falls back to the row's own agent_phone otherwise (either
   Timeweb-by-phone, for a legacy row with no agent_id yet, or the original
   Supabase-agents-table behavior if Timeweb isn't configured at all). */
function billingKeyForRow(row) {
  return makeKey(normalizePhone(row.agent_phone), row.agent_id);
}

/* ---------------- Public listing view (GET /api/listings/:id/view) --------
   Replaces the old client-side call straight to Supabase's get_listing_by_id
   RPC (js/app.js loadListingFromServer) — that RPC returned agent_phone
   straight off the listings row, which stopped being an option the moment
   agent_phone stopped being reliably populated there (see
   supabase/migrations/0007_agent_id_link.sql). This endpoint keeps the same
   "single row by exact random uuid, unguessable, nothing to enumerate"
   security property (service_role bypasses RLS the same way the old
   security-definer function did) and additionally resolves the phone to
   show buyers from Timeweb via agent_id when the row has one — the one
   deliberate exception to "Supabase never sees a phone number again": the
   agent chose to publish it on this exact page, so server.js fetches it
   for display, but nothing about it is ever written back into Supabase. */
async function handlePublicListingView(req, res, id) {
  try {
    const res2 = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id) + '&select=*');
    if (!res2.ok) { sendJson(res, 502, { error: 'lookup failed' }); return; }
    const rows = await res2.json();
    if (!rows.length) { sendJson(res, 200, null); return; }
    const row = rows[0];

    const unlimited = await isAgentUnlimited(billingKeyForRow(row));
    const isExpired = !!row.expires_at && new Date(row.expires_at) < new Date() && !row.paid_via_credit && !unlimited;
    if (isExpired) { sendJson(res, 200, { expired: true }); return; }

    if (timeweb.configured() && row.agent_id) {
      row.agent_phone = await twGetAgentPhoneDisplay(row.agent_id);
      // agent_name/agent_photo_path are null on any row created once Timeweb
      // was configured (see handleCreateListing) — this is what actually
      // fills them back in for display, same as the phone line above.
      // agent_photo_dataurl (not a Storage path — see mapRowToListing,
      // js/app.js) carries the photo inline as base64 since it isn't in
      // Supabase Storage to link to.
      const profile = await twGetAgentProfile(row.agent_id);
      row.agent_name = profile.name;
      row.agent_photo_dataurl = profile.photoDataUrl;
    }
    sendJson(res, 200, row);
  } catch (e) {
    console.error('public-listing-view failed:', e);
    sendJson(res, 500, { error: 'lookup failed' });
  }
}

/* ---------------- Edit auth (see LISTING_ACTION_RE "edit-auth") ----------
   Быстросайт has no login system — a listing's "owner" has only ever been
   "whoever knows its agent_phone" (same identity model the finalize/credits
   gates already use). Before this, the *only* thing standing between a
   random visitor with a /p/<id> link and full edit access to someone
   else's listing was a client-side button — anyone could open devtools (or
   just click "← Редактировать", nothing even checked) and start editing.
   This endpoint is what /edit/<id> (js/app.js) calls to require the
   listing's own phone number, typed deliberately, before that button is
   even shown — see handleCreateListing below for the second half: the
   actual update is *also* rejected unless the submitted agentPhone still
   matches, so this isn't just a UI-only gate. */
function handleListingEditAuth(req, res, id) {
  readJsonBody(req, 500, function (err, body) {
    (async function () {
      const row = await getListingRow(id);
      if (!row) { sendJson(res, 404, { error: 'not found' }); return; }
      const candidate = normalizePhone(!err && body ? body.phone : '');
      let ok = candidate.length === 10;
      if (ok && timeweb.configured() && row.agent_id) {
        // Find-only (never creates a row) — a wrong guess must fail
        // closed, not spawn a junk Timeweb agent.
        ok = (await twFindAgentIdByPhone(candidate)) === row.agent_id;
      } else if (ok) {
        ok = candidate === normalizePhone(row.agent_phone);
      }
      sendJson(res, ok ? 200 : 403, { ok: ok });
    })().catch(function (e) {
      console.error('listing-edit-auth failed:', e);
      sendJson(res, 500, { error: 'edit-auth failed' });
    });
  });
}

function readJsonBody(req, maxBytes, cb) {
  var body = '';
  var tooLarge = false;
  req.on('data', function (chunk) {
    body += chunk;
    if (!tooLarge && body.length > maxBytes) { tooLarge = true; req.destroy(); }
  });
  req.on('end', function () {
    if (tooLarge) { cb(new Error('payload too large')); return; }
    try { cb(null, JSON.parse(body || '{}')); } catch (e) { cb(e); }
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/* ---------------- GET-ish status: can this listing be edited right now? ----
   Used by the "← Редактировать" entry point to fail fast — before the agent
   types anything — rather than only discovering a lock on the next submit. */
function handleListingAccess(req, res, id) {
  (async function () {
    const row = await getListingRow(id);
    if (!row) { sendJson(res, 404, { error: 'not found' }); return; }
    const key = billingKeyForRow(row);
    const unlimited = await isAgentUnlimited(key);
    const credits = unlimited ? 0 : await getAgentCredits(key);
    sendJson(res, 200, {
      isFinalized: !!row.is_finalized,
      freeFinalizeUsed: !!row.free_finalize_used,
      unlimited: unlimited,
      credits: credits,
      // Same rule handleCreateListing's edit gate uses: locked only if
      // finalized AND neither unlimited nor a credit in the wallet.
      canEdit: !row.is_finalized || unlimited || credits > 0,
    });
  })().catch(function (e) {
    console.error('listing-access check failed:', e);
    sendJson(res, 200, { isFinalized: false, freeFinalizeUsed: false, unlimited: false, credits: 0, canEdit: true });
  });
}

/* ---------------- Reopen a finalized listing for editing ----------------
   Free (per the answered design question): having a credit or an active
   subscription is what unlocks editing again — the credit itself is only
   actually spent later, at the next finalize (see handleListingFinalize).
   Does nothing (still ok:true) if the listing wasn't locked to begin with. */
function handleListingReopen(req, res, id) {
  (async function () {
    const row = await getListingRow(id);
    if (!row) { sendJson(res, 404, { error: 'not found' }); return; }
    if (!row.is_finalized) { sendJson(res, 200, { ok: true }); return; }
    const key = billingKeyForRow(row);
    const unlimited = await isAgentUnlimited(key);
    const credits = unlimited ? 0 : await getAgentCredits(key);
    if (!unlimited && credits <= 0) { sendJson(res, 200, { ok: false, needsPayment: true }); return; }
    const upd = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_finalized: false }),
    });
    if (!upd.ok) { sendJson(res, 500, { error: 'reopen failed' }); return; }
    sendJson(res, 200, { ok: true });
  })().catch(function (e) {
    console.error('listing-reopen failed:', e);
    sendJson(res, 500, { error: 'reopen failed' });
  });
}

/* ---------------- Finalize (Share / Download PDF) ----------------
   Two-phase so the client can show the right confirmation *before* anything
   is locked or spent: { confirm: false } (or omitted) is a dry run that
   reports what would happen without changing anything; { confirm: true }
   actually performs it. The server re-derives everything from the DB on
   both calls rather than trusting whatever the client claims the cost is. */
function handleListingFinalize(req, res, id) {
  readJsonBody(req, 1e3, function (err, body) {
    const confirm = !err && body && body.confirm === true;
    (async function () {
      const row = await getListingRow(id);
      if (!row) { sendJson(res, 404, { error: 'not found' }); return; }
      const key = billingKeyForRow(row);
      const unlimited = await isAgentUnlimited(key);

      if (unlimited) {
        // "is_finalized не устанавливается никогда" — no lock, no lookup of
        // free/credit state, no confirmation needed; just let it through.
        sendJson(res, 200, { ok: true, finalized: true, unlimited: true });
        return;
      }
      if (row.is_finalized) {
        // Already finalized *and nothing has changed since* (the only way
        // back to is_finalized:false is an explicit, credit-gated reopen —
        // see handleListingReopen/handleCreateListing) — so Share and
        // PDF are just two independent, always-available ways to fetch the
        // same already-finalized presentation, not a spend of the same
        // one-time resource. Previously this branch blocked the *second*
        // one of them (e.g. PDF after Share had already finalized it),
        // even on a first, still-free round — that "or-or" between the two
        // actions is exactly what this now avoids.
        sendJson(res, 200, { ok: true, finalized: true });
        return;
      }
      if (!confirm) {
        // Dry run: a plain read is fine here — nothing is spent yet, and
        // the real decision (does this phone *still* have its free
        // finalize by the time confirm:true actually arrives) happens
        // atomically below regardless of what this hint said.
        const phoneFreeUsed = await getAgentFreeFinalizeUsed(key);
        if (!phoneFreeUsed) { sendJson(res, 200, { ok: false, needsConfirm: true, cost: 'free' }); return; }
      } else {
        // confirm:true — actually try to spend the phone's free finalize,
        // atomically (see claimAgentFreeFinalize). Only reached here if
        // it's still unclaimed *at this exact moment*; falls through to
        // the credit path below if not (already used, or a concurrent
        // finalize for another listing on this phone just won the race).
        const claimed = await claimAgentFreeFinalize(key, row.agent_phone);
        if (claimed) {
          const upd = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id), {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ is_finalized: true, free_finalize_used: true }),
          });
          if (!upd.ok) { sendJson(res, 500, { error: 'finalize failed' }); return; }
          sendJson(res, 200, { ok: true, finalized: true });
          return;
        }
      }
      const credits = await getAgentCredits(key);
      if (credits <= 0) { sendJson(res, 200, { ok: false, needsPayment: true }); return; }
      // credits is the *current* (pre-spend) balance — the confirm modal's
      // copy ("...останется {credits}" / "{credits} left after") promises
      // the balance *after* this spend, so subtract the 1 this finalize is
      // about to cost.
      if (!confirm) { sendJson(res, 200, { ok: false, needsConfirm: true, cost: 'credit', creditsRemaining: credits - 1 }); return; }
      const spent = await spendAgentCredit(key, credits);
      if (!spent) { sendJson(res, 409, { error: 'credit already spent elsewhere, retry' }); return; }
      // Paid for with a real credit now — permanent from this point on,
      // regardless of whatever expires_at was set to at creation (see
      // 0003_listing_expiry.sql).
      const upd = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_finalized: true, paid_via_credit: true, expires_at: null }),
      });
      if (!upd.ok) { sendJson(res, 500, { error: 'finalize failed' }); return; }
      sendJson(res, 200, { ok: true, finalized: true });
    })().catch(function (e) {
      console.error('listing-finalize failed:', e);
      sendJson(res, 500, { error: 'finalize failed' });
    });
  });
}

/* ---------------- Listing creation (POST /api/listings) ----------------
   Everything the anon key is deliberately NOT allowed to do (see the RLS
   section of supabase/migrations/0001_init.sql) happens here instead, using
   the service_role key: upload each photo/logo/agent-photo/QR data URL the
   form collected to Storage, then insert (or, for a phone that already owns
   a listing, update) the row. The browser only ever gets back a listing id
   — never the service_role key. */
function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function extFromContentType(ct) {
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  return 'jpg';
}

// relPath is built by callers from client-supplied slot/QR keys
// (photosBySlot / agentQr object keys in the listing POST body, e.g.
// "photos/" + slotKey or "qr-" + qrKey) — those keys are the only thing
// standing between that and a Storage object path like
// "../../<victim id>/photos/cover.jpg" landing outside this listing's own
// folder (supabaseStorageUpload runs with the service_role key, which
// bypasses RLS, and "x-upsert: true" would happily overwrite whatever it
// resolves to). Every real slot/QR key is short and alphanumeric-ish
// (cover, bedroom3, whatsapp, ...) — checking each "/"-separated segment
// against that shape rejects "..", empty segments, and anything else that
// could escape id + '/' below, while still accepting the "photos/<slot>"
// shape callers actually use.
const SAFE_PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

async function uploadDataUrl(id, relPath, dataUrl) {
  if (!relPath.split('/').every(function (seg) { return SAFE_PATH_SEGMENT_RE.test(seg); })) {
    console.error('uploadDataUrl: rejected unsafe relPath', relPath);
    return null;
  }
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;
  const objectPath = id + '/' + relPath + '.' + extFromContentType(decoded.contentType);
  const uploadRes = await supabaseStorageUpload(objectPath, decoded.buffer, decoded.contentType);
  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error('storage upload failed for ' + objectPath + ': ' + uploadRes.status + ' ' + body);
  }
  return objectPath;
}

const REQUIRED_LISTING_FIELDS = ['title', 'locationName', 'lat', 'lng', 'houseArea', 'bedrooms', 'bathrooms', 'agentPhone'];

function handleCreateListing(req, res) {
  // 15MB used to be the cap here, but a real listing's own photos (not the
  // tiny stock-photo URLs) routinely blow past it: up to ~30 slots (facade,
  // interiors, every bedroom/bathroom) each a few hundred KB as base64,
  // plus logo/agent photo/QR codes. That's what silently turned into
  // "не удалось сохранить презентацию" once an agent uploaded their own
  // photos and data instead of using the demo listing.
  readJsonBody(req, 60e6, async function (err, listing) {
    if (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid body' }));
      return;
    }
    if (!supabaseConfigured()) {
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Supabase is not configured on this server (set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' }));
      return;
    }
    const missing = REQUIRED_LISTING_FIELDS.filter(function (k) {
      return listing[k] === undefined || listing[k] === null || listing[k] === '';
    });
    if (missing.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing fields', fields: missing }));
      return;
    }

    // listing.id present = editing an existing listing in place (same
    // /p/<id> link throughout); absent = a brand-new listing, always
    // allowed regardless of credits (see 0002_finalize_and_credits.sql).
    // An existing, *finalized* listing can only be edited if the owning
    // phone has a credit or an active subscription — same gate as
    // handleListingReopen, checked again here since a resubmit is itself
    // a form of "reopening" it. Reusing an id doesn't reset its finalize
    // state; only handleListingFinalize/handleListingReopen do that.
    //
    // Wrapped in one try from here on (not just around the photo-upload/
    // DB-write section below) because the Timeweb agent-linking calls
    // just below (ensureAgentByPhone, twFindAgentIdByPhone, isAgentUnlimited)
    // are just as capable of throwing (bad credentials, network hiccup) as
    // anything in the photo-upload section — and this function's caller
    // (readJsonBody) never wraps or awaits this async callback, so an
    // exception thrown outside a try here becomes an unhandled promise
    // rejection that crashes the whole Node process instead of just
    // failing this one request.
    try {
    const hasValidId = typeof listing.id === 'string' && /^[0-9a-f-]{36}$/i.test(listing.id);
    const id = hasValidId ? listing.id : crypto.randomUUID();
    const isUpdate = hasValidId;
    let reopening = false;
    // Declared here (not just inside `if (isUpdate)`) so the photo/logo/
    // agent-photo/QR merge further down — which needs to fall back to
    // "already stored" for anything the agent didn't personally re-upload
    // on *this* save — can read it too; stays null on a fresh create.
    let existing = null;
    // Set whenever Timeweb is configured — the agents.agent_id this listing
    // (new or existing) is linked to, so the row written below can store
    // that instead of a raw phone number. Stays null if Timeweb isn't
    // configured at all, in which case row.agent_phone below is written
    // exactly as before.
    let agentId = null;
    if (isUpdate) {
      existing = await getListingRow(id);
      if (!existing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'listing not found' }));
        return;
      }
      // The one server-side ownership check in the whole update path — see
      // handleListingEditAuth above for the client-facing half of this.
      // Without it, anyone who knows a listing's id (e.g. from its own
      // /p/<id> link) could POST arbitrary changes to it with any phone
      // number in the body; the finalize/credit checks below only ever
      // asked "does *this* phone have credits", never "is this actually
      // the same phone that created the listing".
      let ok;
      if (timeweb.configured() && existing.agent_id) {
        const submittedAgentId = await twFindAgentIdByPhone(normalizePhone(listing.agentPhone));
        ok = submittedAgentId !== null && submittedAgentId === existing.agent_id;
        if (ok) agentId = submittedAgentId;
      } else {
        ok = normalizePhone(listing.agentPhone) === normalizePhone(existing.agent_phone);
      }
      if (!ok) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'phone mismatch' }));
        return;
      }
      if (existing.is_finalized) {
        const key = billingKeyForRow(existing);
        const unlimited = await isAgentUnlimited(key);
        const credits = unlimited ? 0 : await getAgentCredits(key);
        if (!unlimited && credits <= 0) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'finalized', blocked: true }));
          return;
        }
        // They have a credit or subscription: saving this edit is itself
        // what reopens it (free — the credit is only spent at the next
        // finalize, see handleListingFinalize), so the resulting deck no
        // longer reads as locked.
        reopening = true;
      }
      // A legacy row (created before Timeweb was configured, so it has no
      // agent_id yet) gets one now, on the strength of the ownership check
      // just above — a progressive, per-row migration that only ever
      // happens as a side effect of the agent's own deliberate edit, never
      // as a bulk operation touching rows nobody asked to change.
      if (timeweb.configured() && !agentId) {
        agentId = await ensureAgentByPhone(normalizePhone(listing.agentPhone), listing.agentPhone);
      }
    } else if (timeweb.configured()) {
      agentId = await ensureAgentByPhone(normalizePhone(listing.agentPhone), listing.agentPhone);
    }

    // A brand-new free-tier listing gets a 30-day clock (see
    // 0003_listing_expiry.sql) — an agent who's already unlimited at
    // creation time never needs one. Set once, here, at creation; never
    // touched again except by handleListingFinalize when a credit pays
    // for this specific listing (which clears it for good).
    let expiresAt = null;
    if (!isUpdate) {
      const unlimitedAtCreation = await isAgentUnlimited(makeKey(normalizePhone(listing.agentPhone), agentId));
      if (!unlimitedAtCreation) expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

      // On an update, mapRowToListing (js/app.js) sends every untouched
      // slot/logo/agent-photo/QR back as its existing public Storage URL,
      // not a data: URI — those aren't re-uploaded below, on purpose. Once
      // this loop only kept entries whose dataUrl started with "data:", so
      // every image the agent didn't personally re-pick on *this* save got
      // silently dropped from the row (photos={}/logo_path=null/etc.)
      // instead of staying published. `existing` (already fetched above,
      // null on a fresh create) is what lets each branch fall back to
      // "still there, just unchanged" instead of "gone".
      const existingPhotos = (existing && existing.photos) || {};
      const photos = {};
      const photosBySlot = listing.photosBySlot || {};
      for (const slotKey of Object.keys(photosBySlot)) {
        const photo = photosBySlot[slotKey];
        if (!photo || typeof photo.dataUrl !== 'string') continue;
        if (photo.dataUrl.indexOf('data:') === 0) {
          const uploaded = await uploadDataUrl(id, 'photos/' + slotKey, photo.dataUrl);
          if (uploaded) photos[slotKey] = uploaded;
        } else if (existingPhotos[slotKey]) {
          // Unchanged (its dataUrl is the Storage URL mapRowToListing gave
          // it, or — on a fresh create — a stock /assets/stock/*.jpg demo
          // path, which never matches an existingPhotos entry). Keep
          // whatever's already stored for this slot rather than dropping
          // it. A slot missing from photosBySlot entirely (the agent
          // removed it — see the "x" button handler) stays out of `photos`
          // too, same as before: removal is still real removal.
          photos[slotKey] = existingPhotos[slotKey];
        }
      }

      let logoPath = null;
      if (listing.logo && typeof listing.logo.dataUrl === 'string' && listing.logo.dataUrl.indexOf('data:') === 0) {
        logoPath = await uploadDataUrl(id, 'logo', listing.logo.dataUrl);
      } else if (listing.logo && existing && existing.logo_path) {
        logoPath = existing.logo_path;
      }

      // Once this listing has an agent_id, its agent's name+photo live in
      // Timeweb (see twSetAgentProfile below) — Supabase Storage never
      // receives a photo of the agent themselves from here on, same
      // "agent_id means Supabase stops seeing this personal data" rule
      // agent_phone already follows.
      let agentPhotoPath = null;
      if (!agentId) {
        if (typeof listing.agentPhoto === 'string' && listing.agentPhoto.indexOf('data:') === 0) {
          agentPhotoPath = await uploadDataUrl(id, 'agent', listing.agentPhoto);
        } else if (listing.agentPhoto && existing && existing.agent_photo_path) {
          agentPhotoPath = existing.agent_photo_path;
        }
      } else {
        const decodedPhoto = typeof listing.agentPhoto === 'string' ? decodeDataUrl(listing.agentPhoto) : null;
        await twSetAgentProfile(agentId, listing.agentName, decodedPhoto ? decodedPhoto.buffer : null, decodedPhoto ? decodedPhoto.contentType : null);
      }

      const existingQr = (existing && existing.agent_qr) || {};
      const agentQr = {};
      const agentQrIn = listing.agentQr || {};
      for (const qrKey of Object.keys(agentQrIn)) {
        const qrVal = agentQrIn[qrKey];
        if (typeof qrVal !== 'string') continue;
        if (qrVal.indexOf('data:') === 0) {
          const uploaded = await uploadDataUrl(id, 'qr-' + qrKey, qrVal);
          if (uploaded) agentQr[qrKey] = uploaded;
        } else if (existingQr[qrKey]) {
          agentQr[qrKey] = existingQr[qrKey];
        }
      }

      const row = {
        id,
        property_type: listing.propertyType || 'cottage',
        floor_number: listing.floorNumber,
        title: listing.title,
        description: listing.description,
        emotion_phrase: listing.emotionPhrase,
        closing_phrase: listing.closingPhrase,
        location_name: listing.locationName,
        lat: listing.lat,
        lng: listing.lng,
        currency: listing.currency || 'RUB',
        sale_price: listing.salePrice,
        rent_price: listing.rentPrice,
        rent_period: listing.rentPeriod,
        rent_market_range: listing.rentMarketRange,
        house_area: listing.houseArea,
        plot_area: listing.plotArea,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        pool_size: listing.poolSize,
        yard: listing.yard,
        floors: listing.floors,
        furnished: listing.furnished,
        garage_spaces: listing.garageSpaces,
        security: !!listing.security,
        auto_gate: !!listing.autoGate,
        extra_features: listing.extraFeatures,
        complex_name: listing.complexName,
        build_year: listing.buildYear,
        building_class: listing.buildingClass,
        building_floors: listing.buildingFloors,
        elevators: listing.elevators,
        parking: listing.parking,
        infrastructure: listing.infrastructure,
        nearby: listing.nearby,
        management_company: listing.managementCompany,
        cam_fee: listing.camFee,
        cleaning_fee: listing.cleaningFee,
        cleaning_period: listing.cleaningPeriod,
        pool_maintenance_fee: listing.poolMaintenanceFee,
        company_name: listing.companyName,
        logo_path: logoPath,
        // agent_name, like agent_phone below, is deliberately never
        // (re)written into Supabase once agent_id links out to Timeweb's
        // own copy of it (see twSetAgentProfile above).
        agent_name: agentId ? null : listing.agentName,
        // Once Timeweb is configured, agent_id is the row's real identity
        // link and the raw phone is deliberately never (re)written into
        // Supabase — see billingKeyForRow / handlePublicListingView for how
        // both billing checks and the public display of this number are
        // resolved from agent_id instead, server-side.
        agent_id: agentId,
        agent_phone: agentId ? null : listing.agentPhone,
        agent_photo_path: agentPhotoPath,
        agent_messengers: listing.agentMessengers || [],
        agent_qr: agentQr,
        photos,
      };
      if (!isUpdate) {
        // Payment is confirmed manually (QR + Telegram, per the /pricing
        // screen) — a listing is always created as free/tier 0 here.
        // Whoever confirms a payment flips these two columns directly
        // (Table Editor, or a future admin endpoint), same as today's
        // manual "проверка платежа" step. Left out of an update's PATCH
        // body entirely (below) so re-submitting the form never resets an
        // already-paid listing back to free.
        row.is_paid = false;
        row.paid_tier = 0;
        row.expires_at = expiresAt;
        // Fixed once, here, at creation — see 0005_language_and_edit_lockdown.sql.
        // Left out of an update's PATCH body entirely (same reasoning as
        // is_paid/paid_tier above) so re-submitting the form in whatever
        // language the agent's UI happens to be in right now can never
        // silently flip an already-published presentation's language.
        row.language = listing.language === 'en' ? 'en' : 'ru';
      }
      if (reopening) row.is_finalized = false;

      const listingRes = isUpdate
        ? await supabaseRest('/listings?id=eq.' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(row),
        })
        : await supabaseRest('/listings', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(row),
        });
      if (!listingRes.ok) {
        const body = await listingRes.text();
        throw new Error((isUpdate ? 'update' : 'insert') + ' failed: ' + listingRes.status + ' ' + body);
      }

      // Reaching this point always means the listing is (now) editable —
      // handleCreateListing only ever gets here when it wasn't finalized,
      // or when reopening it (above) just cleared that flag.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: id, isFinalized: false }));
    } catch (e) {
      console.error('create-listing failed:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'failed to save listing' }));
    }
  });
}

const LISTING_ACTION_RE = /^\/api\/listings\/([0-9a-f-]{36})\/(access|reopen|finalize|edit-auth|view)$/i;

/* ---------------- Per-listing Open Graph preview for /p/<id> ----------------
   index.html's <meta property="og:*"> tags are static — fine for the site
   itself, wrong for a shared listing link: every /p/<id> pasted into
   WhatsApp/Telegram would show the same generic "Коттедж «Аврора»" demo
   photo and title, never the agent's own listing. This intercepts exactly that
   route, fetches the row directly (service_role bypasses RLS — no need
   for the anon-safe get_listing_by_id RPC here), and serves index.html
   with those five tags swapped for the listing's own cover photo/title/
   description before the client-side app ever loads. Every other request
   (including the /preview and /new-listing SPA routes) is untouched. */
const PRESENTATION_PAGE_RE = /^\/p\/([0-9a-f-]{36})$/i;

function escapeHtmlAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function listingOgImageUrl(photos) {
  if (!photos || typeof photos !== 'object') return null;
  const key = photos.cover ? 'cover' : Object.keys(photos)[0];
  if (!key) return null;
  return SUPABASE_URL + '/storage/v1/object/public/' + SUPABASE_BUCKET + '/' + photos[key];
}

function handlePresentationPage(req, res, id) {
  function serveDefault() {
    fs.readFile(path.join(root, 'index.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }

  if (!supabaseConfigured()) { serveDefault(); return; }

  supabaseRest('/listings?id=eq.' + encodeURIComponent(id) + '&select=title,description,photos,location_name')
    .then((r) => (r.ok ? r.json() : null))
    .then((rows) => {
      const listing = rows && rows[0];
      if (!listing) { serveDefault(); return; }

      fs.readFile(path.join(root, 'index.html'), 'utf8', (err, html) => {
        if (err) { serveDefault(); return; }

        const title = escapeHtmlAttr(listing.title || 'Презентация объекта');
        const description = escapeHtmlAttr(
          listing.description ||
          ('Презентация объекта недвижимости' + (listing.location_name ? ' в ' + listing.location_name : '') + '.')
        );
        const proto = req.headers['x-forwarded-proto'] || 'http';
        const pageUrl = escapeHtmlAttr(proto + '://' + req.headers.host + '/p/' + id);
        const imageUrl = listingOgImageUrl(listing.photos);

        let out = html
          .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + title + '">')
          .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + description + '">')
          .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + pageUrl + '">')
          .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + title + '">')
          .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + description + '">');
        if (imageUrl) {
          const escapedImage = escapeHtmlAttr(imageUrl);
          out = out
            .replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + escapedImage + '">')
            .replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + escapedImage + '">');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(out);
      });
    })
    .catch((e) => { console.warn('presentation OG render failed:', e); serveDefault(); });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/listings') {
    handleCreateListing(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/pricing/pay') {
    handlePricingPay(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/prodamus-webhook') {
    handleProdamusWebhook(req, res);
    return;
  }
  const actionMatch = req.url.split('?')[0].match(LISTING_ACTION_RE);
  if (actionMatch && (req.method === 'POST' || req.method === 'GET')) {
    const id = actionMatch[1], action = actionMatch[2];
    if (action === 'access') { handleListingAccess(req, res, id); return; }
    if (action === 'reopen' && req.method === 'POST') { handleListingReopen(req, res, id); return; }
    if (action === 'finalize' && req.method === 'POST') { handleListingFinalize(req, res, id); return; }
    if (action === 'edit-auth' && req.method === 'POST') { handleListingEditAuth(req, res, id); return; }
    if (action === 'view' && req.method === 'GET') { handlePublicListingView(req, res, id); return; }
  }
  if (req.method === 'GET' && req.url.split('?')[0] === '/api/static-map') {
    handleStaticMap(req, res);
    return;
  }
  const presentationMatch = req.method === 'GET' && req.url.split('?')[0].match(PRESENTATION_PAGE_RE);
  if (presentationMatch) {
    handlePresentationPage(req, res, presentationMatch[1]);
    return;
  }

  // decodeURIComponent throws URIError on malformed percent-encoding (e.g.
  // a lone "%E0") — req.url is entirely attacker-controlled, and an
  // uncaught throw here happens synchronously inside the request handler
  // with nothing catching it, which kills the whole Node process for
  // every client on one bad request.
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  // Clean route -> the real static file. Not an SPA view (privacy.html is
  // its own standalone page, not one of index.html's client-routed
  // .view divs), so it needs this explicit rewrite rather than relying on
  // the catch-all "unknown path -> index.html" fallback below.
  if (urlPath === '/privacy') urlPath = '/privacy.html';
  if (urlPath === '/oferta') urlPath = '/oferta.html';
  if (urlPath === '/payment-consent') urlPath = '/payment-consent.html';

  // Everything this server needs to serve as a plain static file lives
  // under one of these — an *allowlist*, not a denylist, because the
  // project root sits right next to this file and previously anything in
  // it was fair game: GET /server.js served this entire file back
  // (verbatim, no auth) to any visitor, and so did /package.json,
  // /.env.example, and every migration under /supabase/ — full backend
  // source, DB schema, and config, all publicly downloadable, confirmed
  // live in production before this fix. Only these four top-level HTML
  // pages and these three asset directories are meant to be public;
  // everything else (including future files someone drops in root) falls
  // through to the SPA fallback below, same as any other 404 would.
  const PUBLIC_ROOT_FILES = new Set(['/index.html', '/privacy.html', '/oferta.html', '/payment-consent.html']);
  const PUBLIC_DIR_PREFIXES = ['/css/', '/js/', '/assets/'];
  const publiclyServable = PUBLIC_ROOT_FILES.has(urlPath) || PUBLIC_DIR_PREFIXES.some(function (p) { return urlPath.indexOf(p) === 0; });

  const ext = path.extname(urlPath).toLowerCase();
  let filePath = path.join(root, urlPath);
  if (distAvailable && (ext === '.js' || ext === '.css')) {
    const distPath = path.join(distDir, urlPath);
    if (fs.existsSync(distPath)) filePath = distPath;
  }

  // Defense in depth even with the allowlist above: path.join collapses
  // ".." segments rather than rejecting them, so a request like
  // GET /js/../../../../etc/passwd (urlPath decoded straight from the
  // client, and "/js/..." alone is enough to pass the prefix check above)
  // could otherwise still resolve outside `root` entirely. Confirm the
  // resolved path really lives under root (or distDir) before ever
  // touching the filesystem with it.
  const resolvedPath = path.resolve(filePath);
  const withinRoot = resolvedPath === path.resolve(root) || resolvedPath.startsWith(path.resolve(root) + path.sep);
  const withinDist = distAvailable && (resolvedPath === path.resolve(distDir) || resolvedPath.startsWith(path.resolve(distDir) + path.sep));
  if (!publiclyServable || (!withinRoot && !withinDist)) {
    // Same SPA fallback as a genuine 404 (see below) — an agent's own
    // clean route never has an extension or one of the prefixes above, so
    // this never intercepts real navigation, only attempts to reach
    // something outside the allowlist.
    fs.readFile(path.join(root, 'index.html'), (err2, indexData) => {
      if (err2) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexData);
    });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Clean routes like /new-listing, /preview or /p/<id> don't map to a
      // real file — fall back to index.html so the client-side router can
      // take over.
      fs.readFile(path.join(root, 'index.html'), (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexData);
      });
      return;
    }
    // No cache-control headers meant Chrome could apply heuristic caching to
    // js/css during active development, serving a stale file after an edit
    // with no way to tell short of a hard refresh. Dev server, so: never cache.
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log('Быстросайт dev server: http://localhost:' + port + '/new-listing');
  if (!supabaseConfigured()) {
    console.log('  (Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; /api/listings will 501 without it, including the finalize/credits endpoints)');
  }
  if (!YANDEX_STATIC_MAPS_API_KEY && !GEOAPIFY_API_KEY && !GOOGLE_MAPS_API_KEY) {
    console.log('  (No YANDEX_STATIC_MAPS_API_KEY, GEOAPIFY_API_KEY or GOOGLE_MAPS_API_KEY is set — PDF export will fall back to a text-only Location slide instead of a static map image)');
  }
  if (!PRODAMUS_SECRET_KEY) {
    console.log('  (PRODAMUS_SECRET_KEY is not set — /pricing payments will 501; set it and point the payform.ru notification URL at /api/prodamus-webhook)');
  }
  if (!timeweb.configured()) {
    console.log('  (Timeweb not configured — set TIMEWEB_DB_HOST/NAME/USER/PASSWORD; until then, agent phone numbers/whitelist/credits keep living in Supabase exactly as before)');
  }
});
