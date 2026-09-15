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
  '.webmanifest': 'application/manifest+json; charset=utf-8',
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

/* ---------------- Phone identity ----------------
   normalizePhone(): strip everything but digits, then keep only the last 10
   — so "+7 937 166-75-55", "89371667555" and "9371667555" all collapse to
   the same key regardless of how the 7/8/+7 prefix was written. This is the
   same rule the DB's listings.agent_phone_normalized generated column uses
   (see supabase/migrations/0001_init.sql).

   Быстросайт is entirely free — creating, editing, finalizing (Share /
   Download PDF) and reopening a listing are all unlimited and unlocked for
   every phone number, no credits or subscriptions involved. The phone
   number itself is still required on every listing: it's the tool's lead
   database — every agent who uses it leaves their contact info behind. */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/* Never log a full phone number anywhere in this file. Platform logs
   (Render's included) are themselves outside Russia, and avoiding exactly
   that kind of durable copy of a phone number leaving the country is the
   whole point of the Timeweb split above — masked to the last 4 digits,
   which is enough to eyeball/correlate log lines by hand without it being a
   usable phone number. */
function maskPhone(phone) {
  var s = String(phone || '');
  return s.length >= 4 ? '***' + s.slice(-4) : '***';
}

/* ---------------- Timeweb (Moscow) agent identity ----------------
   Backed by lib/timeweb.js instead of the Supabase REST API — see the
   Supabase/Timeweb split note near the top of this file. These are the
   lead-database primitives: every listing's agent phone/name/photo. */

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

async function getListingRow(id) {
  const res = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id) + '&select=id,agent_phone,agent_id,is_finalized,photos,logo_path,agent_photo_path,agent_qr');
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? rows[0] : null;
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
    // Everything is free — a finalized listing can always be reopened/edited.
    sendJson(res, 200, { isFinalized: !!row.is_finalized, canEdit: true });
  })().catch(function (e) {
    console.error('listing-access check failed:', e);
    sendJson(res, 200, { isFinalized: false, canEdit: true });
  });
}

/* ---------------- Reopen a finalized listing for editing ----------------
   Free and unlimited — reopening never needs anything beyond the listing
   itself existing. Does nothing (still ok:true) if it wasn't locked to
   begin with. */
function handleListingReopen(req, res, id) {
  (async function () {
    const row = await getListingRow(id);
    if (!row) { sendJson(res, 404, { error: 'not found' }); return; }
    if (!row.is_finalized) { sendJson(res, 200, { ok: true }); return; }
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
   Free and unlimited: locks the listing (listings.is_finalized) the first
   time, so a shared /p/<id> link keeps showing what was actually shared
   rather than whatever the agent happens to be mid-edit on right now.
   Already-finalized is a no-op success — Share and PDF are just two
   independent, always-available ways to fetch the same presentation. */
function handleListingFinalize(req, res, id) {
  (async function () {
    const row = await getListingRow(id);
    if (!row) { sendJson(res, 404, { error: 'not found' }); return; }
    if (row.is_finalized) { sendJson(res, 200, { ok: true, finalized: true }); return; }
    const upd = await supabaseRest('/listings?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_finalized: true }),
    });
    if (!upd.ok) { sendJson(res, 500, { error: 'finalize failed' }); return; }
    sendJson(res, 200, { ok: true, finalized: true });
  })().catch(function (e) {
    console.error('listing-finalize failed:', e);
    sendJson(res, 500, { error: 'finalize failed' });
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

const REQUIRED_LISTING_FIELDS = ['title', 'agentName', 'agentPhone'];

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
    // Price is "sale OR rent", not a fixed field name — same one-of-two rule
    // enforced client-side in js/app.js's updateRequiredHighlights().
    const missingPrice = (listing.salePrice === undefined || listing.salePrice === null)
      && (listing.rentPrice === undefined || listing.rentPrice === null);
    if (missing.length || missingPrice) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing fields', fields: missingPrice ? missing.concat(['salePrice or rentPrice']) : missing }));
      return;
    }

    // listing.id present = editing an existing listing in place (same
    // /p/<id> link throughout); absent = a brand-new listing. Both are
    // always free and unlimited. An existing, *finalized* listing resubmit
    // is itself a form of "reopening" it (same as handleListingReopen) —
    // always allowed, never gated. Reusing an id doesn't reset its finalize
    // state; only handleListingFinalize/handleListingReopen do that.
    //
    // Wrapped in one try from here on (not just around the photo-upload/
    // DB-write section below) because the Timeweb agent-linking calls
    // just below (ensureAgentByPhone, twFindAgentIdByPhone) are just as
    // capable of throwing (bad credentials, network hiccup) as
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
        // Saving this edit is itself what reopens it — free, unlimited —
        // so the resulting deck no longer reads as locked.
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
        community_info: listing.communityInfo,
        building_info: listing.buildingInfo,
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
        // Supabase — see handlePublicListingView for how the public display
        // of this number is resolved from agent_id instead, server-side.
        agent_id: agentId,
        agent_phone: agentId ? null : listing.agentPhone,
        agent_photo_path: agentPhotoPath,
        agent_messengers: listing.agentMessengers || [],
        agent_qr: agentQr,
        photos,
      };
      if (!isUpdate) {
        // Everything is free — no payment/tier/expiry to track.
        row.is_paid = false;
        row.paid_tier = 0;
        row.expires_at = null;
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

  // Everything this server needs to serve as a plain static file lives
  // under one of these — an *allowlist*, not a denylist, because the
  // project root sits right next to this file and previously anything in
  // it was fair game: GET /server.js served this entire file back
  // (verbatim, no auth) to any visitor, and so did /package.json,
  // /.env.example, and every migration under /supabase/ — full backend
  // source, DB schema, and config, all publicly downloadable, confirmed
  // live in production before this fix. Only these top-level HTML pages
  // and these three asset directories are meant to be public; everything
  // else (including future files someone drops in root) falls through to
  // the SPA fallback below, same as any other 404 would.
  const PUBLIC_ROOT_FILES = new Set(['/index.html', '/privacy.html']);
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
    console.log('  (Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; /api/listings will 501 without it)');
  }
  if (!YANDEX_STATIC_MAPS_API_KEY && !GEOAPIFY_API_KEY && !GOOGLE_MAPS_API_KEY) {
    console.log('  (No YANDEX_STATIC_MAPS_API_KEY, GEOAPIFY_API_KEY or GOOGLE_MAPS_API_KEY is set — PDF export will fall back to a text-only Location slide instead of a static map image)');
  }
  if (!timeweb.configured()) {
    console.log('  (Timeweb not configured — set TIMEWEB_DB_HOST/NAME/USER/PASSWORD; until then, agent phone numbers keep living in Supabase exactly as before)');
  }
});
