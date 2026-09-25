/* ============================================================
   Быстросайт — app shell: router + /new-listing form logic.
   No backend yet: form data lives in memory (window.BS.listing)
   and is handed to js/deck.js to render the /preview slide deck.
   ============================================================ */

window.BS = window.BS || {};

(function () {
  'use strict';

  /* ---------------- Copy-protection friction ----------------
     Raises the bar for a casual visitor trying to lift a listing's photos/
     text/phone number or poke at how the site works: no right-click, no
     text selection, no image drag, no copy/cut, and the common devtools/
     view-source shortcuts are swallowed. Every rule below carves out
     <input>/<textarea>/[contenteditable] so the agent's own form (typing,
     pasting an address or description, etc.) is completely unaffected —
     see isEditableTarget.

     Not, and cannot be, real security: this is all client-side JS running
     in the visitor's own browser, same as the rest of this file. Nothing
     here stops someone who disables JavaScript, opens DevTools anyway (the
     shortcuts below are trivially reassignable/bypassable, and DevTools can
     also be opened via the browser's own menu, which no page can intercept),
     or simply fetches a URL directly (curl, "Save Page As", the network
     tab) — the HTML/CSS/JS/images are necessarily sent to every browser
     that loads the page. See scripts/build.js's own comment on terser
     mangling for the same caveat applied to the shipped source itself:
     minified/mangled, not secret. */
  function isEditableTarget(el) {
    return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
  }
  document.addEventListener('contextmenu', function (e) {
    if (!isEditableTarget(e.target)) e.preventDefault();
  });
  document.addEventListener('dragstart', function (e) {
    if (!isEditableTarget(e.target)) e.preventDefault();
  });
  ['copy', 'cut'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      if (!isEditableTarget(e.target)) e.preventDefault();
    });
  });
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    var isDevToolsCombo =
      k === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c')) ||
      ((e.ctrlKey || e.metaKey) && !e.shiftKey && (k === 'U' || k === 'u')) ||
      (e.metaKey && e.altKey && (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c'));
    if (isDevToolsCombo) e.preventDefault();
  });

  BS.listing = null; // set on submit
  BS.logo = null;     // { name, dataUrl } | null

  // Demo fill: every slot starts seeded with a sample photo (client-supplied,
  // originally bystrosite/образец) matching its role, so the example deck
  // reads as a finished presentation rather than a wall of placeholders.
  // The agent can replace or remove any of these the same way as a real
  // upload. interiorExtra and facade4 are intentionally left unseeded —
  // no matching sample photo exists for either.
  var STOCK_SLOTS = ['cover', 'emotion', 'facade1', 'facade2', 'facade3', 'living', 'pool', 'terrace', 'terrace2',
    'detail1', 'detail2', 'detail3', 'interiorHall', 'interiorKitchen', 'interiorDining',
    'bedroom1', 'bedroom2', 'bedroom3', 'bedroom4',
    'bathroom1', 'bathroom2', 'bathroom3', 'final'];
  BS.photosBySlot = {}; // { [slotKey]: { name, dataUrl } }
  STOCK_SLOTS.forEach(function (key) {
    BS.photosBySlot[key] = { name: key + '.jpg', dataUrl: 'assets/stock/' + key + '.jpg' };
  });

  // The official demo/example listing — same content as the form's
  // pre-filled defaults, kept as one fixed object so the landing page can
  // render its 12 thumbnails without needing the form ever touched.
  BS.exampleListing = {
    propertyType: 'house',
    floorNumber: null,
    title: 'Коттедж «Аврора»',
    description: 'Одноэтажный коттедж с приватным бассейном в закрытом посёлке в 7 минутах от моря в Сочи. Полностью меблирован, панорамное остекление гостиной, средиземноморский сад по периметру участка.',
    emotionPhrase: '',
    closingPhrase: '',
    locationName: 'Хоста, Сочи, Краснодарский край',
    lat: 43.5397,
    lng: 39.8944,
    country: 'Россия',
    currency: 'RUB',
    salePrice: 12500000,
    rentPrice: 95000,
    rentPeriod: 'month',
    houseArea: 260,
    plotArea: 420,
    bedrooms: 4,
    bathrooms: 3,
    poolSize: '3 × 7 м',
    yard: 'Огороженный, с газоном',
    floors: 2,
    furnished: 'full',
    garageSpaces: 2,
    security: true,
    autoGate: true,
    extraFeatures: 'Видовая терраса на крыше, система «умный дом», мебель premium-класса',
    communityInfo: 'Закрытый посёлок с охраной, общим бассейном и зоной барбекю',
    buildingInfo: '',
    complexName: 'Коттеджный посёлок «Аврора Парк»',
    buildYear: 2022,
    buildingClass: 'business',
    buildingFloors: null,
    elevators: '',
    parking: 'Открытый гостевой, у каждого дома — свой',
    infrastructure: 'Закрытая охраняемая территория, детская и спортивная площадки, ландшафтный двор без машин, консьерж-сервис',
    nearby: 'Пляж — 7 минут\nЦентр Сочи — 15 минут\nМеждународная школа — 12 минут\nСупермаркет «Магнит» — 5 минут\nЙога-студия — 3 минуты\nАэропорт Сочи (Адлер) — 30 минут',
    managementCompany: 'УК «Аврора»',
    camFee: 5500,
    cleaningFee: 800,
    cleaningPeriod: 'week',
    poolMaintenanceFee: 3000,
    rentMarketRange: '80 000 – 110 000 ₽ / мес.',
    companyName: 'Аврора Недвижимость',
    photosBySlot: BS.photosBySlot,
    logo: null,
    agentName: 'Имя агента',
    agentPhone: '+7 900 000-00-00',
    agentPhoto: null,
    agentMessengers: ['whatsapp', 'telegram'],
    agentQr: {},
  };

  /* ---------------- Supabase-backed listing links (/p/<id>) ----------------
     /preview only ever shows BS.listing already sitting in memory (the form
     just submitted in this tab). /p/<id> is the durable, shareable link:
     it fetches the row via server.js (see loadListingFromServer below) and
     reshapes it into the exact {photosBySlot, logo, agentPhoto, agentQr}
     shape js/deck.js already renders, by turning each stored Storage *path*
     into a public URL. deck.js needed zero changes for this: it just does
     <img src="listing.photosBySlot[key].dataUrl">, and a public Storage URL
     works there exactly like the base64 dataUrl the live form produces. */
  function sbPublicUrl(path) {
    if (!path) return null;
    return window.BS_SUPABASE.url + '/storage/v1/object/public/bystrosite/' + path;
  }

  /* GET /api/listings/:id/view (server.js) — replaces a former direct
     browser->Supabase call to the get_listing_by_id RPC. That RPC read
     agent_phone straight off the listings row; once a listing's agent_id
     links out to Timeweb instead (152-ФЗ data localization — see
     supabase/migrations/0007_agent_id_link.sql), only the server can
     resolve that phone number for display, since Timeweb is never reachable
     from the browser. Resolves to null (not found / request failed) or the
     normal mapped listing. */
  function loadListingFromServer(id) {
    return fetch('/api/listings/' + encodeURIComponent(id) + '/view').then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (row) {
      if (!row) return null;
      return mapRowToListing(row);
    }).catch(function (err) {
      console.warn('loadListingFromServer failed:', err);
      return null;
    });
  }

  function mapRowToListing(row) {
    var photosBySlot = {};
    Object.keys(row.photos || {}).forEach(function (key) {
      photosBySlot[key] = { name: key, dataUrl: sbPublicUrl(row.photos[key]) };
    });
    var agentQr = {};
    Object.keys(row.agent_qr || {}).forEach(function (key) {
      agentQr[key] = sbPublicUrl(row.agent_qr[key]);
    });
    return {
      id: row.id,
      propertyType: row.property_type,
      floorNumber: row.floor_number,
      title: row.title,
      description: row.description,
      emotionPhrase: row.emotion_phrase,
      closingPhrase: row.closing_phrase,
      locationName: row.location_name,
      lat: row.lat,
      lng: row.lng,
      country: row.country,
      currency: row.currency,
      salePrice: row.sale_price,
      rentPrice: row.rent_price,
      rentPeriod: row.rent_period,
      houseArea: row.house_area,
      plotArea: row.plot_area,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      poolSize: row.pool_size,
      yard: row.yard,
      floors: row.floors,
      furnished: row.furnished,
      garageSpaces: row.garage_spaces,
      security: row.security,
      autoGate: row.auto_gate,
      extraFeatures: row.extra_features,
      communityInfo: row.community_info,
      buildingInfo: row.building_info,
      complexName: row.complex_name,
      buildYear: row.build_year,
      buildingClass: row.building_class,
      buildingFloors: row.building_floors,
      elevators: row.elevators,
      parking: row.parking,
      infrastructure: row.infrastructure,
      nearby: row.nearby,
      managementCompany: row.management_company,
      camFee: row.cam_fee,
      cleaningFee: row.cleaning_fee,
      cleaningPeriod: row.cleaning_period,
      poolMaintenanceFee: row.pool_maintenance_fee,
      rentMarketRange: row.rent_market_range,
      companyName: row.company_name,
      photosBySlot: photosBySlot,
      logo: row.logo_path ? { name: 'logo', dataUrl: sbPublicUrl(row.logo_path) } : null,
      agentName: row.agent_name,
      agentPhone: row.agent_phone,
      // agent_photo_dataurl (inline base64, from Timeweb — see
      // handlePublicListingView/twGetAgentProfile in server.js) takes
      // priority once set; agent_photo_path (a Supabase Storage path) is
      // only ever populated on a legacy row that predates Timeweb.
      agentPhoto: row.agent_photo_dataurl || sbPublicUrl(row.agent_photo_path),
      agentMessengers: row.agent_messengers || [],
      agentQr: agentQr,
      isFinalized: !!row.is_finalized,
      // Computed server-side, live, off expires_at (handlePublicListingView)
      // — 30 days after creation, see supabase/migrations/0003_listing_expiry.sql.
      // Only the public /p/<id> render path (renderRoute below) acts on
      // this; the agent's own /edit/<id> ignores it, so an expired listing
      // can always still be reopened and fixed.
      isExpired: !!row.is_expired,
      // Fixed at creation server-side (see 0005_language_and_edit_lockdown.sql)
      // — the web view and PDF render in *this*, never the viewer's own
      // browser language. Old rows predate the column: default to 'ru'.
      language: row.language === 'en' ? 'en' : 'ru',
    };
  }

  /* ---------------- Router ---------------- */

  var viewLanding = document.getElementById('view-landing');
  var viewForm = document.getElementById('view-form');
  var viewPreview = document.getElementById('view-preview');
  var deckBackBtn = document.getElementById('deckBack');
  var deckEditEntryBtn = document.getElementById('deckEditEntry');

  /* ---------------- Edit-access gate (/edit/<id>) ----------------
     /p/<id> (below) is the link an agent sends a client — a read-only
     presentation, full stop, with no edit affordance anywhere in its DOM.
     /edit/<id> is the *only* route that can ever show "← Редактировать":
     it's the agent's own re-entry point into a listing they already
     created, and reaching it (on a fresh browser/session — see
     editAuthorized() below) requires proving you know the listing's own
     agent phone number via POST /api/listings/:id/edit-auth (server.js) —
     not just clicking a button, which is all the old shared view/edit view
     required. sessionStorage (not localStorage) so "authorized" doesn't
     outlive the browser tab/session it was granted in. */
  var EDIT_AUTH_PREFIX = 'bs-edit-ok:';
  var editGateModalEl = document.getElementById('editGateModal');
  var editGatePhoneEl = document.getElementById('editGatePhone');
  var editGatePhoneErrorEl = document.getElementById('editGatePhoneError');
  var editGateSubmitEl = document.getElementById('editGateSubmit');
  var editGatePendingId = null;

  // Set only at the two places BS.listing is assigned through a genuinely
  // phone-verified path — finishSubmit/persistListing (the agent just typed
  // their own phone into the form) and loadAndShowEdit (only ever reached
  // after editAuthorized() already passed once). Deliberately NOT set when
  // BS.listing is assigned from the public /p/<id> view (renderRoute's
  // shareId branch) — anyone with that link can load it, no phone required,
  // so its id alone must never be enough to prove ownership below.
  var editAuthorizedListingId = null;

  // This tab's proven edit_token for editAuthorizedListingId, once known —
  // kept in memory rather than re-read from location.search on every use,
  // because the "← Редактировать" button (deckBackBtn) navigates to
  // /new-listing, which drops the ?t= query string entirely (this is a
  // pushState SPA, not a reload, so the variable itself survives that;
  // re-parsing the URL at that point would not). finishSubmit below is
  // what actually needs it, for the resubmit that follows.
  var currentEditToken = null;

  function markEditAuthorized(id) {
    try { sessionStorage.setItem(EDIT_AUTH_PREFIX + id, '1'); } catch (e) {}
  }

  function editAuthorized(id) {
    // A listing this tab already has in memory *and* just went through a
    // phone-verified path for that same id — see editAuthorizedListingId
    // above — proves ownership just as well as the sessionStorage gate
    // below would, without a fresh round-trip.
    if (BS.listing && BS.listing.id === id && editAuthorizedListingId === id) return true;
    try { return sessionStorage.getItem(EDIT_AUTH_PREFIX + id) === '1'; } catch (e) { return false; }
  }

  function sharedListingId() {
    var m = location.pathname.match(/^\/p\/([0-9a-fA-F-]{36})/);
    return m ? m[1] : null;
  }

  function editListingId() {
    var m = location.pathname.match(/^\/edit\/([0-9a-fA-F-]{36})/);
    return m ? m[1] : null;
  }

  // The secret half of /edit/<id>?t=<token> — see server.js
  // handleListingEditAuth/0010_edit_token.sql. Read fresh off location.search
  // each time rather than cached, since history.replaceState below can
  // change it mid-session (a legacy listing's phone-auth upgrading to a
  // real token).
  function editTokenFromUrl() {
    var m = /[?&]t=([0-9a-f]+)/i.exec(location.search);
    return m ? m[1] : null;
  }

  function currentView() {
    if (editListingId()) return 'edit';
    if (location.pathname.startsWith('/preview') || sharedListingId()) return 'preview';
    if (location.pathname.startsWith('/new-listing')) return 'form';
    return 'landing';
  }

  // Renders the shared "not found" stage state used by both the public
  // /p/<id> view and the agent's own /edit/<id> view. Returns true if it
  // handled (drew) a failure state, false if `listing` is usable and the
  // caller should proceed to render it.
  function renderLoadFailure(stageEl, listing) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    if (!listing) {
      if (stageEl) stageEl.innerHTML = '<div class="deck-status-msg">' + t('deckNotFound') + '</div>';
      return true;
    }
    return false;
  }

  // A public /p/<id> whose listing is past its 30-day lifespan (see
  // supabase/migrations/0003_listing_expiry.sql, computed live server-side
  // in handlePublicListingView) — shown instead of the deck, never as well
  // as it. Only ever called from the shareId branch below.
  function renderExpired(stageEl) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    if (stageEl) stageEl.innerHTML = '<div class="deck-status-msg deck-expired-msg"><p>' + t('deckExpired') + '</p></div>';
  }

  var pendingShareId = null; // guards against a slower, stale fetch clobbering a newer navigation
  var pendingEditId = null;  // same, for the /edit/<id> fetch below

  // Loads listing `id` from the server and shows it with the edit button
  // visible — only ever called once editAuthorized(id) is true.
  function loadAndShowEdit(id) {
    pendingEditId = id;
    viewLanding.hidden = true; viewForm.hidden = true; viewPreview.hidden = false;
    // Not shown until the listing has actually loaded (showPreview(true)
    // below) — avoids a stray, non-functional edit button on the
    // loading/not-found stage states.
    if (deckBackBtn) deckBackBtn.hidden = true;
    if (deckEditEntryBtn) deckEditEntryBtn.hidden = true;
    var stageEl = document.getElementById('stage');
    if (stageEl) stageEl.innerHTML = '<div class="deck-status-msg">' + (window.BSI18n ? window.BSI18n.t('deckLoading') : 'Загрузка…') + '</div>';
    loadListingFromServer(id).then(function (listing) {
      if (pendingEditId !== id) return; // navigated elsewhere while this was in flight
      if (renderLoadFailure(stageEl, listing)) return;
      BS.listing = listing;
      editAuthorizedListingId = id; // only reached once editAuthorized(id) already passed once — see its definition
      rememberMyListing(listing, currentEditToken || editTokenFromUrl());
      // The agent's own working language for this edit session follows the
      // listing's own stored language (persisted — this becomes the active
      // language for the form too if they go on to "← Редактировать").
      if (window.BSI18n) window.BSI18n.setLang(listing.language || 'ru');
      showPreview(true);
    });
  }

  function showEditGateModal(editId) {
    viewLanding.hidden = true; viewForm.hidden = true; viewPreview.hidden = false;
    var gateStageEl = document.getElementById('stage');
    if (gateStageEl) gateStageEl.innerHTML = '';
    if (deckBackBtn) deckBackBtn.hidden = true;
    if (deckEditEntryBtn) deckEditEntryBtn.hidden = true;
    editGatePendingId = editId;
    editGatePhoneErrorEl.classList.remove('visible');
    editGatePhoneEl.value = '';
    editGateModalEl.hidden = false;
    if (window.BSI18n) window.BSI18n.apply();
  }

  function submitEditGate() {
    var id = editGatePendingId;
    if (!id) return;
    editGatePhoneErrorEl.classList.remove('visible');
    editGateSubmitEl.disabled = true;
    fetch('/api/listings/' + id + '/edit-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: editGatePhoneEl.value }),
    }).then(function (res) { return res.json(); }).then(function (data) {
      editGateSubmitEl.disabled = false;
      if (data && data.ok) {
        markEditAuthorized(id);
        editGateModalEl.hidden = true;
        // A freshly minted token (legacy row, first time authenticated by
        // phone since edit_token existed — see server.js
        // handleListingEditAuth) upgrades this /edit/<id> link so it never
        // needs the public phone number again.
        if (data.token) {
          currentEditToken = data.token;
          history.replaceState(null, '', '/edit/' + id + '?t=' + data.token);
        }
        loadAndShowEdit(id);
      } else {
        editGatePhoneErrorEl.classList.add('visible');
      }
    }).catch(function () {
      editGateSubmitEl.disabled = false;
      editGatePhoneErrorEl.classList.add('visible');
    });
  }

  if (editGateSubmitEl) editGateSubmitEl.addEventListener('click', submitEditGate);
  if (editGatePhoneEl) editGatePhoneEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitEditGate(); }
  });

  var pendingTokenAuthId = null;
  var lastFailedTokenAuth = null; // "<id>:<token>" — stops a bad URL token from being retried in a loop

  // Auto-auth path for /edit/<id>?t=<token> — skips the phone modal
  // entirely when the URL already carries this listing's own edit_token
  // (the normal case: the agent's own bookmarked/browser-history link from
  // when they created or last edited it). Falls back to the phone modal on
  // any failure (wrong/stale token).
  function tryTokenAuth(id, token) {
    pendingTokenAuthId = id;
    viewLanding.hidden = true; viewForm.hidden = true; viewPreview.hidden = false;
    if (deckBackBtn) deckBackBtn.hidden = true;
    if (deckEditEntryBtn) deckEditEntryBtn.hidden = true;
    var stageEl = document.getElementById('stage');
    if (stageEl) stageEl.innerHTML = '<div class="deck-status-msg">' + (window.BSI18n ? window.BSI18n.t('deckLoading') : 'Загрузка…') + '</div>';
    fetch('/api/listings/' + id + '/edit-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (pendingTokenAuthId !== id) return; // navigated elsewhere while this was in flight
      if (data && data.ok) {
        markEditAuthorized(id);
        currentEditToken = token;
        loadAndShowEdit(id);
      } else {
        lastFailedTokenAuth = id + ':' + token;
        showEditGateModal(id);
      }
    }).catch(function () {
      if (pendingTokenAuthId !== id) return;
      lastFailedTokenAuth = id + ':' + token;
      showEditGateModal(id);
    });
  }

  function renderRoute() {
    var view = currentView();
    var shareId = sharedListingId();

    if (view === 'edit') {
      var editId = editListingId();
      if (!editAuthorized(editId)) {
        var urlToken = editTokenFromUrl();
        if (urlToken && lastFailedTokenAuth !== (editId + ':' + urlToken)) {
          tryTokenAuth(editId, urlToken);
          return;
        }
        showEditGateModal(editId);
        return;
      }
      // A real page reload (not just an SPA navigate()) keeps sessionStorage
      // but resets currentEditToken to null — re-derive it from the URL
      // (still there; only navigate('/new-listing') ever drops it, which
      // can't have happened without a fresh renderRoute() of its own).
      if (!currentEditToken) currentEditToken = editTokenFromUrl();
      editGateModalEl.hidden = true;
      if (BS.listing && BS.listing.id === editId) {
        showPreview(true);
        return;
      }
      loadAndShowEdit(editId);
      return;
    }
    editGateModalEl.hidden = true;

    if (view === 'preview' && shareId) {
      if (BS.listing && BS.listing.id === shareId) {
        if (BS.listing.isExpired) { renderExpired(document.getElementById('stage')); return; }
        showPreview(false);
        return;
      }
      pendingShareId = shareId;
      viewLanding.hidden = true; viewForm.hidden = true; viewPreview.hidden = false;
      // Hidden immediately, not just after showPreview(false) below — a
      // public /p/<id> must never show "← Редактировать", including while
      // still loading or if the listing turns out not to exist, not only
      // once it has successfully rendered. Otherwise this stayed at
      // whatever showPreview(true) had last left it as (e.g. the agent's
      // own /new-listing → /preview flow just before, in the same tab).
      if (deckBackBtn) deckBackBtn.hidden = true;
      if (deckEditEntryBtn) deckEditEntryBtn.hidden = true;
      var stageEl = document.getElementById('stage');
      if (stageEl) stageEl.innerHTML = '<div class="deck-status-msg">' + (window.BSI18n ? window.BSI18n.t('deckLoading') : 'Загрузка…') + '</div>';
      loadListingFromServer(shareId).then(function (listing) {
        if (pendingShareId !== shareId) return; // navigated elsewhere while this was in flight
        if (renderLoadFailure(stageEl, listing)) return;
        // Only the public /p/<id> render path enforces this — the agent's
        // own /edit/<id> (loadAndShowEdit) never calls renderExpired, so an
        // expired listing can always still be reopened and fixed there.
        if (listing.isExpired) { renderExpired(stageEl); return; }
        BS.listing = listing;
        // Deliberately NOT setting editAuthorizedListingId here — this is
        // the public, no-phone-required view; see its definition above for
        // why that distinction matters (this exact id/tab combination is
        // what deckEditEntryBtn's click handler routes into /edit/<id>).
        // The *listing's own* fixed language, never this visitor's browser
        // locale/previously-saved preference — see 0005_language_and_edit_lockdown.sql.
        // persist:false so viewing someone else's shared link never
        // overwrites this visitor's own saved RU/EN choice.
        if (window.BSI18n) window.BSI18n.setLang(listing.language || 'ru', false);
        showPreview(false);
      });
      return;
    }

    if (view === 'preview' && !shareId && !BS.listing) {
      // Nothing to preview yet (e.g. direct load of /preview) — send back to the form.
      navigate('/new-listing', true);
      return;
    }

    viewLanding.hidden = view !== 'landing';
    viewForm.hidden = view !== 'form';
    viewPreview.hidden = view !== 'preview';
    // The only other way to reach 'preview' is the agent's own same-tab
    // flow right after submitting the form (BS.listing is already theirs —
    // see finishSubmit) — edit access always allowed there.
    if (view === 'preview') showPreview(true);
    if (view === 'landing' && window.BSDeck) {
      window.BSDeck.renderThumbnails(BS.exampleListing);
    }
    if (window.BSI18n) window.BSI18n.apply();
  }

  // allowEdit controls whether "← Редактировать" is shown at all — true
  // only for the agent's own same-tab /preview flow and an authorized
  // /edit/<id>; always false for a public /p/<id> view. See showPreview's
  // callers above for exactly which route passes which. The inverse case
  // (!allowEdit) shows deckEditEntryBtn instead — the agent's own way back
  // in from that same public link, in case they spot a mistake after
  // sending it. Only when there's actually an id to edit: a same-tab
  // agent-authored /preview (BS.listing set locally, allowEdit true) never
  // reaches this branch, but guard anyway since BS.listing.id can still be
  // unset for a moment right after submit, before persistListing() returns.
  function showPreview(allowEdit) {
    viewLanding.hidden = true; viewForm.hidden = true; viewPreview.hidden = false;
    if (deckBackBtn) deckBackBtn.hidden = !allowEdit;
    if (deckEditEntryBtn) deckEditEntryBtn.hidden = allowEdit || !BS.listing || !BS.listing.id;
    var saveLinkBtn = document.getElementById('deckSaveLinkBtn');
    if (saveLinkBtn) saveLinkBtn.hidden = !allowEdit;
    if (window.BSDeck) window.BSDeck.render(BS.listing);
    if (window.BSI18n) window.BSI18n.apply();
  }

  function navigate(path, replace) {
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    renderRoute();
  }
  BS.navigate = navigate;

  window.addEventListener('popstate', renderRoute);

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-nav]');
    if (!el) return;
    var path = el.getAttribute('data-nav') || el.getAttribute('href');
    if (!path) return;
    e.preventDefault();
    navigate(path);
  });

  renderRoute();

  /* ---------------- Finalize / edit-lock ----------------
     Everything is free and unlimited. Finalizing (Share / Download PDF)
     just locks the listing so a shared /p/<id> link keeps showing what was
     actually shared rather than whatever's mid-edit; reopening it for
     another edit is always allowed. Both talk to the server, which is the
     only thing allowed to write to the listings row, and share one generic
     info modal for the few things that can still go wrong (still saving,
     network hiccup). */

  var finalizeModalEl = document.getElementById('finalizeModal');
  var finalizeModalMessageEl = document.getElementById('finalizeModalMessage');
  var finalizeModalActionsEl = document.getElementById('finalizeModalActions');

  function hideFinalizeModal() { finalizeModalEl.hidden = true; }

  function showFinalizeModal(message, buttons) {
    finalizeModalMessageEl.textContent = message;
    finalizeModalActionsEl.innerHTML = '';
    buttons.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.primary ? 'btn-primary' : 'btn-ghost');
      btn.textContent = b.label;
      btn.addEventListener('click', function () { hideFinalizeModal(); if (b.onClick) b.onClick(); });
      finalizeModalActionsEl.appendChild(btn);
    });
    finalizeModalEl.hidden = false;
  }

  /* window.alert() is a native blocking dialog — beyond being visually
     inconsistent with the rest of the app, it can wedge an embedding
     browser context entirely (observed directly: it disconnected the
     Chrome automation extension mid-click during testing). Every
     finalize-flow message uses this instead. */
  function showInfoModal(message) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    showFinalizeModal(message, [{ label: t('finalizeBlockedClose'), primary: true }]);
  }

  /* Call before actually sharing the link or building the PDF. onApproved
     runs once the finalize call comes back (or immediately, on a network
     hiccup — a broken finalize check shouldn't be the thing standing
     between a legitimate agent and their own presentation). */
  function requestFinalize(listing, onApproved) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    if (!listing || !listing.id) {
      if (listing && listing._persistError) {
        // Not "still saving" — the save already came back and failed (e.g.
        // the server can't reach Supabase). Say so, and retry once in the
        // background so a second click shortly after has a real chance.
        showInfoModal(t('finalizeSaveFailed'));
        persistListing(listing);
      } else {
        showInfoModal(t('finalizeStillSaving'));
      }
      return;
    }
    fetch('/api/listings/' + listing.id + '/finalize', { method: 'POST' }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok || data.finalized) listing.isFinalized = true;
        else showInfoModal(t('finalizeError'));
        onApproved();
      }).catch(function (err) {
        console.warn('finalize request failed, allowing through:', err);
        onApproved();
      });
  }
  BS.requestFinalize = requestFinalize;

  /* Call before navigating to the edit form. Reopening a finalized listing
     is free and always allowed — this just clears is_finalized server-side
     so the resulting deck no longer reads as locked. */
  function requestEditAccess(listing, onApproved) {
    if (!listing || !listing.id || !listing.isFinalized) { onApproved(); return; }
    fetch('/api/listings/' + listing.id + '/reopen', { method: 'POST' }).then(function (res) { return res.json(); })
      .then(function (r) {
        if (r.ok) listing.isFinalized = false;
        onApproved();
      })
      .catch(function (err) {
        console.warn('reopen request failed, allowing through:', err);
        onApproved();
      });
  }

  if (deckBackBtn) deckBackBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (deckBackBtn.hidden) return; // defense in depth — see showPreview(allowEdit)
    requestEditAccess(BS.listing, function () {
      populateFormFromListing(BS.listing);
      navigate('/new-listing');
    });
  });

  // Just routes to /edit/<id> — renderRoute()'s own editAuthorized() check
  // is what actually gates this (unverified here, on purpose: this button
  // shows on the public /p/<id> view, reached by anyone with the link, not
  // just the agent who created it).
  if (deckEditEntryBtn) deckEditEntryBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (deckEditEntryBtn.hidden || !BS.listing || !BS.listing.id) return;
    navigate('/edit/' + BS.listing.id);
  });

  /* ---------------- My presentations (this device) ----------------
     There's no login: the only way back into a listing is its
     /edit/<id>?t=<token> address, which used to live nowhere but the
     address bar — one crashed tab (a phone running out of memory while
     building the PDF) and it was gone. Every listing this browser creates
     or opens for editing is remembered here, the moment the server hands
     back its id (before any download is even possible), and listed on the
     landing page and the form as "Мои презентации". localStorage, so it
     survives a crash or closed tab; wrapped in try/catch because it can
     be unavailable (private mode) and the site must work without it. */
  var MY_LISTINGS_KEY = 'bs-my-listings';

  function readMyListings() {
    try {
      var list = JSON.parse(localStorage.getItem(MY_LISTINGS_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function rememberMyListing(listing, token) {
    if (!listing || !listing.id) return;
    var list = readMyListings();
    var prev = list.filter(function (x) { return x.id === listing.id; })[0] || {};
    list = list.filter(function (x) { return x.id !== listing.id; });
    list.unshift({ id: listing.id, t: token || prev.t || null, title: listing.title || prev.title || '', at: Date.now() });
    try { localStorage.setItem(MY_LISTINGS_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* storage unavailable */ }
    renderMyListings();
  }

  function renderMyListings() {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var list = readMyListings();
    var lang = window.BSI18n ? window.BSI18n.getLang() : 'ru';
    document.querySelectorAll('.my-listings').forEach(function (box) {
      box.innerHTML = '';
      box.hidden = list.length === 0;
      if (!list.length) return;
      var h = document.createElement('h2');
      h.className = 'my-listings-title';
      h.textContent = t('myListingsTitle');
      box.appendChild(h);
      var ul = document.createElement('ul');
      ul.className = 'my-listings-list';
      list.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'my-listings-item';
        // A real page load (no data-nav): renderRoute's /edit/<id> branch
        // signs in with ?t= on its own, or asks for the agent's phone.
        a.href = '/edit/' + encodeURIComponent(item.id) + (item.t ? '?t=' + encodeURIComponent(item.t) : '');
        var name = document.createElement('span');
        name.className = 'my-listings-name';
        name.textContent = item.title || t('myListingsUntitled');
        var date = document.createElement('span');
        date.className = 'my-listings-date';
        try {
          date.textContent = new Date(item.at).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) { date.textContent = ''; }
        var open = document.createElement('span');
        open.className = 'my-listings-open';
        open.textContent = t('myListingsOpen');
        a.appendChild(name);
        a.appendChild(date);
        a.appendChild(open);
        li.appendChild(a);
        ul.appendChild(li);
      });
      box.appendChild(ul);
      var note = document.createElement('p');
      note.className = 'my-listings-note';
      note.textContent = t('myListingsNote');
      box.appendChild(note);
    });
  }

  /* ---------------- Send a link: Telegram / WhatsApp / MAX / copy ----------------
     One dialog behind both "Поделиться" (the client's /p/<id> link) and
     "Сохранить ссылку для себя" (the agent's private /edit/<id>?t= link).
     Telegram/WhatsApp open with the message ready to send; MAX has no web
     share URL, so it goes through the phone's own share sheet
     (navigator.share), which lists MAX when it's installed — shown only
     where that sheet exists. Every button is its own click, so window.open
     isn't swallowed by the popup blocker even though requestFinalize
     (async) runs before the dialog opens. */
  function copyText(text, onDone) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone, function () { window.prompt(t('shareCopyManual'), text); });
    } else {
      window.prompt(t('shareCopyManual'), text);
    }
  }

  function showSendLinkDialog(intro, message, url, copiedMessage) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var buttons = [
      { label: 'Telegram', onClick: function () { window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(message), '_blank', 'noopener'); } },
      { label: 'WhatsApp', onClick: function () { window.open('https://wa.me/?text=' + encodeURIComponent(message + '\n' + url), '_blank', 'noopener'); } },
    ];
    if (navigator.share) {
      buttons.push({ label: t('saveLinkMax'), onClick: function () {
        navigator.share({ title: message, text: message, url: url }).catch(function () { /* cancelled */ });
      } });
    }
    buttons.push({ label: t('saveLinkCopy'), onClick: function () { copyText(url, function () { showInfoModal(copiedMessage); }); } });
    buttons.push({ label: t('finalizeBlockedClose'), primary: true });
    showFinalizeModal(intro, buttons);
  }

  function showClientShare(listing) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var url = location.origin + '/p/' + listing.id;
    var message = t('clientShareText', { title: listing.title || t('myListingsUntitled') });
    showSendLinkDialog(t('clientShareMessage'), message, url, t('shareCopied', { url: url }));
  }

  /* "Мои презентации" only lives in this browser — this hands the agent
     their private edit link to keep somewhere of their own. Opening it
     later lands straight in the presentation, no phone number needed. */
  function editLinkFor(listing) {
    var token = (listing && listing.editToken) || currentEditToken;
    if (!listing || !listing.id || !token) return null;
    return location.origin + '/edit/' + listing.id + '?t=' + encodeURIComponent(token);
  }

  function showSaveEditLink() {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var listing = BS.listing;
    var url = editLinkFor(listing);
    if (!url) {
      showInfoModal(listing && listing._persistError ? t('finalizeSaveFailed') : t('finalizeStillSaving'));
      return;
    }
    var message = t('saveLinkShareText', { title: listing.title || t('myListingsUntitled') });
    showSendLinkDialog(t('saveLinkMessage'), message, url, t('saveLinkCopied'));
  }

  var deckSaveLinkBtn = document.getElementById('deckSaveLinkBtn');
  if (deckSaveLinkBtn) deckSaveLinkBtn.addEventListener('click', showSaveEditLink);

  /* Called by js/deck.js once the PDF file has been handed to the browser:
     says where the file went and that the presentation itself is safe and
     how to get back to it — the agent stays right on it either way. */
  BS.afterPdfSaved = function () {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var listing = BS.listing;
    var buttons = [];
    if (editLinkFor(listing)) buttons.push({ label: t('deckSaveLinkBtn'), onClick: showSaveEditLink });
    if (listing && listing.id) buttons.push({ label: t('pdfSavedCopyLink'), onClick: function () { showClientShare(listing); } });
    buttons.push({ label: t('pdfSavedBack'), primary: true });
    showFinalizeModal(t('pdfSavedMessage'), buttons);
  };

  var deckShareBtn = document.getElementById('deckShareBtn');
  if (deckShareBtn) deckShareBtn.addEventListener('click', function () {
    requestFinalize(BS.listing, function () { showClientShare(BS.listing); });
  });

  /* ---------------- Coordinates paste (Yandex / Google Maps) ----------------
     The single place an agent gives the property's location: fLat/fLng
     are hidden inputs filled from whatever gets pasted here, and the
     status line below the field confirms what was understood (or says it
     wasn't). Accepted: a plain "lat, lng" pair (dot or comma decimals),
     degrees-minutes-seconds (43°32'23"N 39°53'40"E / с. ш. в. д.), full
     Yandex links (whatshere/pt/ll — lon,lat order, the reverse of
     everywhere else here, same as js/deck.js slideLocation) and Google
     links (!3d!4d pin, @lat,lng, q=/query=/ll=). Short "Share" links from
     the phone apps carry no coordinates at all — those go through the
     server's /api/resolve-map-link, which follows the redirect. */
  var fCoordsPasteEl = document.getElementById('fCoordsPaste');
  var fCoordsStatusEl = document.getElementById('fCoordsStatus');
  var fLatEl = document.getElementById('fLat');
  var fLngEl = document.getElementById('fLng');

  var NUM = '(' + /-?\d+(?:\.\d+)?/.source + ')';

  function parseCoordsInput(text) {
    text = String(text || '').trim().replace(/%2C/gi, ',').replace(/%5B/gi, '[').replace(/%5D/gi, ']');
    if (!text) return null;
    var m;

    if (/yandex\.|ya\.ru/i.test(text)) {
      m = text.match(new RegExp('whatshere\\[point\\]=' + NUM + ',' + NUM)) ||
        text.match(new RegExp('[?&]pt=' + NUM + ',' + NUM)) ||
        text.match(new RegExp('[?&]ll=' + NUM + ',' + NUM));
      if (m) return toLatLng(m[2], m[1]); // Yandex is lon,lat — swap to lat,lng
    }

    // Google: !3d!4d is the dropped pin itself, @ is only the camera centre.
    m = text.match(new RegExp('!3d' + NUM + '!4d' + NUM)) ||
      text.match(new RegExp('[?&](?:q|query|ll|destination)=(?:loc:)?' + NUM + ',\\s*' + NUM)) ||
      text.match(new RegExp('@' + NUM + ',\\s*' + NUM));
    if (m) return toLatLng(m[1], m[2]);

    var dms = parseDms(text);
    if (dms) return dms;

    // "43,5397321 39,8944543" / "43,5397; 39,8944" — decimal commas.
    m = text.match(/^(-?\d+,\d+)\s*[;\s]\s*(-?\d+,\d+)$/);
    if (m) return toLatLng(m[1].replace(',', '.'), m[2].replace(',', '.'));

    // Plain "43.5397321, 39.8944543" (optionally with ° N / ° E).
    var cleaned = text.replace(/[°NSEWnsew]/g, ' ').trim();
    var parts = cleaned.split(cleaned.indexOf(',') !== -1 ? ',' : /[\s;]+/)
      .map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length === 2) return toLatLng(parts[0], parts[1]);
    return null;
  }

  // 43°32'23.0"N 39°53'40.0"E, or Russian 43°32′23″ с. ш. 39°53′40″ в. д.
  function parseDms(text) {
    var re = /(\d+(?:[.,]\d+)?)\s*°\s*(?:(\d+(?:[.,]\d+)?)\s*['′’]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:"|″|”|''|′′)\s*)?([NSEW]|[сю]\.?\s*ш\.?|[вз]\.?\s*д\.?)?/gi;
    var found = [], m;
    while ((m = re.exec(text)) && found.length < 2) {
      var n = function (v) { return v ? Number(String(v).replace(',', '.')) : 0; };
      var val = n(m[1]) + n(m[2]) / 60 + n(m[3]) / 3600;
      var h = (m[4] || '').toLowerCase().replace(/[\s.]/g, '');
      if (h === 's' || h === 'w' || h === 'юш' || h === 'зд') val = -val;
      found.push({ val: val, h: h });
    }
    if (found.length !== 2) return null;
    // Longitude first if the hemisphere letters say so.
    if (/^(e|w|вд|зд)$/.test(found[0].h) && /^(n|s|сш|юш)$/.test(found[1].h)) found.reverse();
    return toLatLng(found[0].val, found[1].val);
  }

  function toLatLng(latStr, lngStr) {
    var lat = Number(latStr), lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  }

  function setCoords(coords) {
    var t = window.BSI18n.t;
    fLatEl.value = coords ? coords.lat : '';
    fLngEl.value = coords ? coords.lng : '';
    fCoordsStatusEl.className = 'coords-status' + (coords ? ' is-ok' : '');
    fCoordsStatusEl.textContent = coords ? t('coordsOk', { lat: coords.lat, lng: coords.lng }) : '';
  }

  function coordsFail() {
    setCoords(null);
    fCoordsStatusEl.className = 'coords-status is-error';
    fCoordsStatusEl.textContent = window.BSI18n.t('coordsFail');
  }

  var coordsRequestSeq = 0;
  function handleCoordsPaste() {
    var text = fCoordsPasteEl.value.trim();
    var seq = ++coordsRequestSeq;
    if (!text) { setCoords(null); return; }
    var coords = parseCoordsInput(text);
    if (coords) { setCoords(coords); return; }

    // A link without coordinates in it (phone "Share" short link, or a
    // place link) — let the server follow it.
    var link = text.match(/https?:\/\/\S+/i);
    if (!link) { coordsFail(); return; }
    setCoords(null);
    fCoordsStatusEl.textContent = window.BSI18n.t('coordsResolving');
    fetch('/api/resolve-map-link?url=' + encodeURIComponent(link[0]))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (seq !== coordsRequestSeq) return; // the field changed meanwhile
        var found = data && (parseCoordsInput(data.url) || (data.coords && toLatLng(data.coords.lat, data.coords.lng)));
        if (found) setCoords(found); else coordsFail();
      })
      .catch(function () { if (seq === coordsRequestSeq) coordsFail(); });
  }

  if (fCoordsPasteEl) {
    fCoordsPasteEl.addEventListener('input', handleCoordsPaste);
  }

  /* Agent headshot only: this one ends up stored as a plain bytea column in
     Timeweb Postgres (see twSetAgentProfile in server.js) rather than a
     Supabase Storage file, and is re-sent inline (base64) inside every
     /api/listings/:id/view response — small isn't just nice-to-have here,
     it's what keeps that row/response cheap. Always re-encodes as JPEG
     (a headshot never needs PNG transparency) and steps quality down until
     the result fits maxBytes, rather than trusting a single quality guess. */
  function resizeImageCapped(file, maxDim, maxBytes) {
    var qualities = [0.82, 0.65, 0.5, 0.35];
    return resizeImage(file, maxDim, qualities[0], false, 'image/jpeg').then(function attempt(dataUrl) {
      var approxBytes = dataUrl.length * 0.75;
      if (approxBytes <= maxBytes || qualities.length <= 1) return dataUrl;
      qualities.shift();
      return resizeImage(file, maxDim, qualities[0], false, 'image/jpeg').then(attempt);
    });
  }

  /* ---------------- Image helper: downscale to a data URL ---------------- */

  function resizeImage(file, maxDim, quality, grade, format) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function (e) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            var scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          if (grade && window.BSColorGrade) window.BSColorGrade.gradeCanvas(canvas);
          var mime = format || (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
          resolve(canvas.toDataURL(mime, quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- Photos (named slots) ---------------- */
  /* Every slot maps 1:1 to a specific spot in the deck (see js/slots.js
     and js/deck.js) — bedroom/bathroom slots are regenerated whenever
     those counts change, so the list always matches the property. */

  var photoSlotsEl = document.getElementById('photoSlots');
  var photoCount = document.getElementById('photoCount');
  var fBedroomsEl = document.getElementById('fBedrooms');
  var fBathroomsEl = document.getElementById('fBathrooms');
  var fPoolSizeEl = document.getElementById('fPoolSize');
  var fYardEl = document.getElementById('fYard');
  var fColorGradeEl = document.getElementById('fColorGrade');

  /* Lowering a count (e.g. 4 bedrooms -> 2) correctly drops those slots
     from the grid below, but previously left photosBySlot['bedroom3']/
     ['bedroom4'] sitting in memory — so raising the count back up made
     an old, stale photo reappear in a slot the agent thought was empty.
     Pruning here, at the one place both counts are read, keeps the two
     always in sync. */
  function pruneOrphanedRoomPhotos(bedroomsN, bathroomsN) {
    Object.keys(BS.photosBySlot).forEach(function (key) {
      var bed = key.match(/^bedroom(\d+)$/);
      if (bed && Number(bed[1]) > bedroomsN) delete BS.photosBySlot[key];
      var bath = key.match(/^bathroom(\d+)$/);
      if (bath && Number(bath[1]) > bathroomsN) delete BS.photosBySlot[key];
    });
  }

  function currentSlots() {
    var hasPool = fPoolSizeEl.value.trim() !== '';
    var hasYard = fYardEl.value.trim() !== '';
    return window.BSSlots.get(fBedroomsEl.value, fBathroomsEl.value, hasPool, hasYard);
  }

  function renderPhotoSlotsUI() {
    var slots = currentSlots();
    photoSlotsEl.innerHTML = '';
    var filled = 0;

    slots.forEach(function (slot, i) {
      var photo = BS.photosBySlot[slot.key];
      if (photo) filled++;

      var tile = document.createElement('div');
      tile.className = 'slot-tile';
      tile.setAttribute('data-slot', slot.key);

      var thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'slot-thumb';
      thumb.title = window.BSI18n.t('slotThumbTitle');

      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.hidden = true;
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var grade = fColorGradeEl ? fColorGradeEl.checked : true;
        resizeImage(file, 1600, 0.82, grade, 'image/jpeg').then(function (dataUrl) {
          BS.photosBySlot[slot.key] = { name: file.name, dataUrl: dataUrl };
          renderPhotoSlotsUI();
        }).catch(function () { showInfoModal(window.BSI18n.t('photoDecodeError')); });
      });
      thumb.addEventListener('click', function () {
        if (Date.now() - lastDragEndAt < 600) return; // the click that ends a drag isn't an "upload" tap
        input.click();
      });

      if (photo) {
        attachSlotDrag(thumb, slot.key);
        var img = document.createElement('img');
        img.src = photo.dataUrl;
        img.alt = slot.label;
        thumb.appendChild(img);

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'slot-remove';
        removeBtn.setAttribute('aria-label', window.BSI18n.t('slotRemoveLabel'));
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          delete BS.photosBySlot[slot.key];
          renderPhotoSlotsUI();
        });
        tile.appendChild(thumb);
        tile.appendChild(removeBtn);
      } else {
        var plus = document.createElement('span');
        plus.className = 'slot-plus';
        plus.textContent = '+';
        thumb.appendChild(plus);
        tile.appendChild(thumb);
      }

      tile.appendChild(input);

      var label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = (i + 1) + '. ' + slot.label;
      tile.appendChild(label);

      photoSlotsEl.appendChild(tile);
    });

    photoCount.textContent = window.BSI18n.t('photoAddCount', { filled: filled, total: slots.length });
  }

  /* ---------------- Bulk upload ----------------
     One multi-select picker (select 20 shots in the phone gallery at once)
     that fills slots in their deck order. Only slots that are empty or still
     hold a demo sample (assets/stock/) are filled — a photo the agent already
     put somewhere on purpose is never overwritten. Files are processed one
     at a time so a phone doesn't decode 20 full-size images simultaneously. */
  var photoBulkBtn = document.getElementById('photoBulkBtn');
  var photoBulkInput = document.getElementById('photoBulkInput');
  var photoBulkStatus = document.getElementById('photoBulkStatus');

  function isReplaceableSlot(key) {
    var p = BS.photosBySlot[key];
    return !p || /^assets\/stock\//.test(p.dataUrl || '');
  }

  photoBulkBtn.addEventListener('click', function () { photoBulkInput.click(); });
  photoBulkInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(photoBulkInput.files || []);
    photoBulkInput.value = '';
    if (!files.length) return;
    var t = window.BSI18n.t;
    var targets = currentSlots().filter(function (s) { return isReplaceableSlot(s.key); }).map(function (s) { return s.key; });
    var toLoad = files.slice(0, targets.length);
    var extra = files.length - toLoad.length;
    var grade = fColorGradeEl ? fColorGradeEl.checked : true;
    var loaded = 0;
    photoBulkBtn.disabled = true;

    toLoad.reduce(function (chain, file, i) {
      return chain.then(function () {
        photoBulkStatus.textContent = t('photoBulkLoading', { done: i + 1, total: toLoad.length });
        return resizeImage(file, 1600, 0.82, grade, 'image/jpeg').then(function (dataUrl) {
          BS.photosBySlot[targets[loaded]] = { name: file.name, dataUrl: dataUrl };
          loaded++;
          renderPhotoSlotsUI();
        }, function () { /* skip an undecodable file, keep going */ });
      });
    }, Promise.resolve()).then(function () {
      photoBulkBtn.disabled = false;
      var skipped = extra + (toLoad.length - loaded);
      photoBulkStatus.textContent = skipped > 0
        ? t('photoBulkOverflow', { count: loaded, extra: skipped })
        : t('photoBulkDone', { count: loaded });
      if (loaded === 0) showInfoModal(t('photoDecodeError'));
    });
  });

  /* ---------------- Drag to swap ----------------
     Drop a photo on another slot to swap the two (or move it, if that slot
     is empty). Built on pointer events rather than HTML5 drag-and-drop,
     which doesn't work on phones and is blocked anyway by the dragstart
     guard at the top of this file. Mouse: drag starts after a small move.
     Touch: press and hold ~0.3s first, so a normal swipe still scrolls. */
  var lastDragEndAt = 0;
  var drag = null; // { key, ghost, overTile, x, y, dx, dy, raf }

  document.addEventListener('touchmove', function (e) {
    if (drag) e.preventDefault(); // keep the page still while a photo is carried
  }, { passive: false });

  function attachSlotDrag(thumb, key) {
    thumb.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || drag) return;
      var startX = e.clientX, startY = e.clientY;
      var isTouch = e.pointerType !== 'mouse';
      var pending = true;
      var holdTimer = isTouch ? setTimeout(begin, 300) : null;

      function begin() {
        if (!pending) return;
        cleanup();
        startSlotDrag(thumb, key, startX, startY);
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* ignore */ } }
      }
      function onMove(ev) {
        if (!pending) return;
        var moved = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
        if (isTouch) { if (moved > 10) cleanup(); } // it's a scroll, not a hold
        else if (moved > 6) { startX = ev.clientX; startY = ev.clientY; begin(); }
      }
      function cleanup() {
        pending = false;
        clearTimeout(holdTimer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', cleanup);
      window.addEventListener('pointercancel', cleanup);
    });
  }

  function startSlotDrag(thumb, key, x, y) {
    var rect = thumb.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'slot-drag-ghost';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    var img = document.createElement('img');
    img.src = BS.photosBySlot[key].dataUrl;
    ghost.appendChild(img);
    document.body.appendChild(ghost);
    thumb.parentNode.classList.add('is-drag-source');
    document.body.classList.add('is-slot-dragging');

    drag = { key: key, ghost: ghost, overTile: null, x: x, y: y, dx: rect.width / 2, dy: rect.height / 2, raf: 0 };
    moveGhost();
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragCancel);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function moveGhost() {
    drag.ghost.style.transform = 'translate(' + (drag.x - drag.dx) + 'px,' + (drag.y - drag.dy) + 'px)';
    var el = document.elementFromPoint(drag.x, drag.y);
    var tile = el && el.closest ? el.closest('#photoSlots .slot-tile') : null;
    if (tile && tile.getAttribute('data-slot') === drag.key) tile = null;
    if (tile !== drag.overTile) {
      if (drag.overTile) drag.overTile.classList.remove('is-drop-target');
      if (tile) tile.classList.add('is-drop-target');
      drag.overTile = tile;
    }
  }

  // Scrolls the page while the finger/cursor sits near the top or bottom
  // edge, so a photo can be carried to a slot that's off-screen.
  function autoScroll() {
    if (!drag) return;
    var edge = 70, h = window.innerHeight, step = 0;
    if (drag.y < edge) step = -Math.ceil((edge - drag.y) / 5);
    else if (drag.y > h - edge) step = Math.ceil((drag.y - (h - edge)) / 5);
    if (step) { window.scrollBy(0, step); moveGhost(); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function onDragMove(e) {
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    moveGhost();
  }

  function finishDrag() {
    cancelAnimationFrame(drag.raf);
    drag.ghost.remove();
    document.body.classList.remove('is-slot-dragging');
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragCancel);
    lastDragEndAt = Date.now();
    var d = drag;
    drag = null;
    return d;
  }

  function onDragEnd(e) {
    if (!drag) return;
    onDragMove(e); // drop where the pointer actually is, even if no move event came in between
    var d = finishDrag();
    if (d.overTile) {
      var toKey = d.overTile.getAttribute('data-slot');
      var a = BS.photosBySlot[d.key], b = BS.photosBySlot[toKey];
      BS.photosBySlot[toKey] = a;
      if (b) BS.photosBySlot[d.key] = b; else delete BS.photosBySlot[d.key];
    }
    renderPhotoSlotsUI();
  }

  function onDragCancel() {
    if (!drag) return;
    finishDrag();
    renderPhotoSlotsUI();
  }

  fBedroomsEl.addEventListener('input', renderPhotoSlotsUI);
  fBathroomsEl.addEventListener('input', renderPhotoSlotsUI);
  fPoolSizeEl.addEventListener('input', renderPhotoSlotsUI);
  fYardEl.addEventListener('input', renderPhotoSlotsUI);

  // Pruning (unlike the live grid re-render above) is destructive — it
  // deletes photos — so it only runs on 'change' (committed on blur, not
  // every keystroke). On 'input', a bedroom/bathroom count briefly reads
  // as empty/0 mid-retype (e.g. selecting "4" and typing "5"), and running
  // this there deleted every bedroom photo before "5" was even finished.
  function pruneRoomPhotosFromFields() {
    var bedroomsN = Math.max(0, Math.floor(Number(fBedroomsEl.value) || 0));
    var bathroomsN = Math.max(0, Math.floor(Number(fBathroomsEl.value) || 0));
    pruneOrphanedRoomPhotos(bedroomsN, bathroomsN);
  }
  fBedroomsEl.addEventListener('change', pruneRoomPhotosFromFields);
  fBathroomsEl.addEventListener('change', pruneRoomPhotosFromFields);

  /* ---------------- Property type ---------------- */
  /* House/cottage show yard/pool/garage/gate/floor-count fields; an
     apartment hides those (clearing their values so the pool/yard
     slide and photo slots stay consistent) and shows a floor number
     instead. */

  var fPropertyTypeEl = document.getElementById('fPropertyType');
  var fCountryEl = document.getElementById('fCountry');

  /* The type list depends on the country chosen right before it: Russian
     listings get дом/коттедж, земельный участок, квартира/апартаменты;
     anywhere else gets кондоминиум, вилла. On a switch between the two
     sets the closest equivalent is kept selected (condo <-> apartment,
     villa <-> house). Legacy 'cottage' rows show as 'house'. */
  var TYPE_OPTIONS_RU = [['house', 'optHouseCottage'], ['land', 'optLand'], ['apartment', 'optApartmentRu']];
  var TYPE_OPTIONS_ABROAD = [['condo', 'optCondo'], ['villa', 'optVilla']];
  var TYPE_EQUIVALENT = { condo: 'apartment', apartment: 'condo', villa: 'house', house: 'villa', cottage: 'house', land: 'villa' };

  /* The presentation map follows the country (Yandex for Russia, Google
     elsewhere — see slideLocation in js/deck.js), so the coordinates-paste
     instructions follow it too. Swapping the data-i18n key (not just the
     text) keeps the right variant across a language switch. */
  function syncMapProviderHints(isRu) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    [['fCoordsPasteLabel', 'fCoordsPasteLabel'], ['fCoordsPasteHint', 'fCoordsPasteHint']].forEach(function (p) {
      var el = document.getElementById(p[0]);
      if (!el) return;
      var key = isRu ? p[1] : p[1] + 'Google';
      el.setAttribute('data-i18n', key);
      el.textContent = t(key);
    });
  }

  /* A listing saved back when country was free text may hold a value that
     isn't one of the dropdown's options — add it rather than silently
     showing (and re-saving) a different country. */
  function setCountryValue(country) {
    country = country || 'Россия';
    var exists = Array.prototype.some.call(fCountryEl.options, function (o) { return o.value === country; });
    if (!exists) {
      var opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      fCountryEl.insertBefore(opt, fCountryEl.lastElementChild);
    }
    fCountryEl.value = country;
  }

  function syncPropertyTypeOptions(wanted) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var isRu = window.BSDeck.isRussiaCountry(fCountryEl.value);
    syncMapProviderHints(isRu);
    var opts = isRu ? TYPE_OPTIONS_RU : TYPE_OPTIONS_ABROAD;
    var current = wanted || fPropertyTypeEl.value;
    var values = opts.map(function (o) { return o[0]; });
    var next = values.indexOf(current) !== -1 ? current
      : values.indexOf(TYPE_EQUIVALENT[current]) !== -1 ? TYPE_EQUIVALENT[current]
      : values[0];
    var sameSet = Array.prototype.map.call(fPropertyTypeEl.options, function (o) { return o.value; }).join() === values.join();
    if (!sameSet) {
      fPropertyTypeEl.innerHTML = '';
      opts.forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o[0];
        opt.setAttribute('data-i18n', o[1]);
        opt.textContent = t(o[1]);
        fPropertyTypeEl.appendChild(opt);
      });
    }
    var changed = fPropertyTypeEl.value !== next || !sameSet;
    fPropertyTypeEl.value = next;
    return changed;
  }

  function applyPropertyType() {
    var type = fPropertyTypeEl.value;
    var isApartment = window.BSDeck.isApartmentLike(type);
    var isLand = type === 'land';
    Array.prototype.forEach.call(document.querySelectorAll('.field-house'), function (el) { el.hidden = isApartment; });
    Array.prototype.forEach.call(document.querySelectorAll('.field-apartment'), function (el) { el.hidden = !isApartment; });
    // A plot of land has no house on it: hide (and clear) everything about
    // rooms/building, keeping plot area, security, extras and посёлок info.
    Array.prototype.forEach.call(document.querySelectorAll('.field-no-land'), function (el) {
      el.hidden = isLand || (isApartment && el.classList.contains('field-house'));
    });
    if (isLand) {
      ['fHouseArea', 'fBedrooms', 'fBathrooms', 'fPoolSize', 'fYard', 'fFloors', 'fFurnished', 'fGarageSpaces'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('fAutoGate').checked = false;
      pruneRoomPhotosFromFields();
    }
    if (isApartment) {
      fPoolSizeEl.value = '';
      fYardEl.value = '';
      document.getElementById('fGarageSpaces').value = '';
      document.getElementById('fAutoGate').checked = false;
      document.getElementById('fFloors').value = '';
      // The other type's "О посёлке"/"О ЖК" text is hidden now, not just
      // visually — clear it so a stale value never quietly rides along
      // into the presentation if the agent switches type again later.
      document.getElementById('fCommunityInfo').value = '';
    } else {
      document.getElementById('fBuildingInfo').value = '';
    }
    renderPhotoSlotsUI();
  }

  fPropertyTypeEl.addEventListener('change', applyPropertyType);
  fCountryEl.addEventListener('change', function () {
    if (syncPropertyTypeOptions()) applyPropertyType();
  });

  /* ---------------- Logo ---------------- */

  var logoAddBtn = document.getElementById('logoAddBtn');
  var logoRemoveBtn = document.getElementById('logoRemoveBtn');
  var logoInput = document.getElementById('logoInput');
  var logoPreview = document.getElementById('logoPreview');

  logoAddBtn.addEventListener('click', function () { logoInput.click(); });

  logoInput.addEventListener('change', function () {
    var file = logoInput.files && logoInput.files[0];
    if (!file) return;
    resizeImage(file, 600, 0.9).then(function (dataUrl) {
      BS.logo = { name: file.name, dataUrl: dataUrl };
      renderLogoPreview();
      logoInput.value = '';
    }).catch(function () { showInfoModal(window.BSI18n.t('photoDecodeError')); });
  });

  logoRemoveBtn.addEventListener('click', function () {
    BS.logo = null;
    renderLogoPreview();
  });

  function renderLogoPreview() {
    logoPreview.innerHTML = '';
    if (BS.logo) {
      var img = document.createElement('img');
      img.src = BS.logo.dataUrl;
      img.alt = BS.logo.name;
      logoPreview.appendChild(img);
      logoRemoveBtn.hidden = false;
    } else {
      var span = document.createElement('span');
      span.textContent = window.BSI18n.t('logoNoLogo');
      logoPreview.appendChild(span);
      logoRemoveBtn.hidden = true;
    }
  }

  /* ---------------- Agent contacts ---------------- */
  /* Everything for the final slide's contact card — photo, name, phone,
     messengers, QR codes — lives in this one form section, same as every
     other listing field. js/deck.js renders the card straight from
     BS.listing; nothing is edited a second time on the slide itself. */

  BS.agentPhoto = null; // dataUrl | null
  BS.agentQr = {};      // { [messengerKey]: dataUrl }

  var MESSENGER_DEFS = [
    { key: 'whatsapp', id: 'fMsgWhatsapp', label: 'WhatsApp' },
    { key: 'telegram', id: 'fMsgTelegram', label: 'Telegram' },
    { key: 'max', id: 'fMsgMax', label: 'MAX' },
  ];

  var agentPhotoAddBtn = document.getElementById('agentPhotoAddBtn');
  var agentPhotoRemoveBtn = document.getElementById('agentPhotoRemoveBtn');
  var agentPhotoInput = document.getElementById('fAgentPhotoInput');
  var agentPhotoPreview = document.getElementById('agentPhotoPreview');
  var qrUploadersEl = document.getElementById('qrUploaders');

  agentPhotoAddBtn.addEventListener('click', function () { agentPhotoInput.click(); });

  agentPhotoInput.addEventListener('change', function () {
    var file = agentPhotoInput.files && agentPhotoInput.files[0];
    if (!file) return;
    resizeImageCapped(file, 400, 150 * 1024).then(function (dataUrl) {
      BS.agentPhoto = dataUrl;
      renderAgentPhotoPreview();
      agentPhotoInput.value = '';
    }).catch(function () { showInfoModal(window.BSI18n.t('photoDecodeError')); });
  });

  agentPhotoRemoveBtn.addEventListener('click', function () {
    BS.agentPhoto = null;
    renderAgentPhotoPreview();
  });

  function renderAgentPhotoPreview() {
    agentPhotoPreview.innerHTML = '';
    if (BS.agentPhoto) {
      var img = document.createElement('img');
      img.src = BS.agentPhoto;
      img.alt = '';
      agentPhotoPreview.appendChild(img);
      agentPhotoRemoveBtn.hidden = false;
    } else {
      var span = document.createElement('span');
      span.textContent = window.BSI18n.t('agentPhotoNone');
      agentPhotoPreview.appendChild(span);
      agentPhotoRemoveBtn.hidden = true;
    }
  }

  function selectedMessengers() {
    return MESSENGER_DEFS.filter(function (m) { return document.getElementById(m.id).checked; })
      .map(function (m) { return m.key; });
  }

  function renderQrUploaders() {
    qrUploadersEl.innerHTML = '';
    selectedMessengers().forEach(function (key) {
      var def = MESSENGER_DEFS.filter(function (m) { return m.key === key; })[0];

      var tile = document.createElement('div');
      tile.className = 'qr-uploader-tile';

      var thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'qr-uploader-thumb';

      var qrData = BS.agentQr[key];
      if (qrData) {
        var img = document.createElement('img');
        img.src = qrData;
        img.alt = 'QR ' + def.label;
        thumb.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.textContent = window.BSI18n.t('qrAddLabel');
        thumb.appendChild(span);
      }

      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.hidden = true;
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        resizeImage(file, 500, 0.85).then(function (dataUrl) {
          BS.agentQr[key] = dataUrl;
          renderQrUploaders();
        }).catch(function () { showInfoModal(window.BSI18n.t('photoDecodeError')); });
      });
      thumb.addEventListener('click', function () { input.click(); });

      tile.appendChild(thumb);
      var label = document.createElement('span');
      label.className = 'qr-uploader-label';
      label.textContent = def.label;
      tile.appendChild(label);
      tile.appendChild(input);
      qrUploadersEl.appendChild(tile);
    });
  }

  MESSENGER_DEFS.forEach(function (m) {
    document.getElementById(m.id).addEventListener('change', function () {
      if (selectedMessengers().length > 2) this.checked = false; // cap at 2 — the contact card has room for two QR codes
      renderQrUploaders();
    });
  });

  renderAgentPhotoPreview();
  renderQrUploaders();

  /* Fills the /new-listing form from an already-saved listing — needed for
     "← Редактировать" whenever the deck currently on screen didn't come
     from this same form submission (i.e. it was fetched from the server:
     /edit/<id> on a fresh browser/session, or /p/<id>). Before this, the
     form's fields simply kept whatever was last typed into them (or the
     static demo defaults, on a fresh page load) — harmless for the
     same-tab "submit → preview → back → submit again" loop this form was
     originally built for, but for a cold /edit/<id> load it meant
     re-submitting silently overwrote the real listing with the demo
     content instead of the agent's own data. Idempotent to call even for
     the same-tab case (round-trips the same values the form already has). */
  function populateFormFromListing(listing) {
    if (!listing) return;
    // Country first: it decides which type options exist (see syncPropertyTypeOptions).
    setCountryValue(listing.country);
    syncPropertyTypeOptions(listing.propertyType || 'house');
    document.getElementById('fFloorNumber').value = listing.floorNumber != null ? listing.floorNumber : '';
    document.getElementById('fTitle').value = listing.title || '';
    document.getElementById('fDescription').value = listing.description || '';
    document.getElementById('fEmotionPhrase').value = listing.emotionPhrase || '';
    document.getElementById('fClosingPhrase').value = listing.closingPhrase || '';
    document.getElementById('fLocationName').value = listing.locationName || '';
    var savedCoords = listing.lat != null && listing.lng != null ? { lat: listing.lat, lng: listing.lng } : null;
    fCoordsPasteEl.value = savedCoords ? savedCoords.lat + ', ' + savedCoords.lng : '';
    setCoords(savedCoords);
    document.getElementById('fCurrency').value = listing.currency || 'RUB';
    document.getElementById('fSalePrice').value = listing.salePrice != null ? listing.salePrice : '';
    document.getElementById('fRentPrice').value = listing.rentPrice != null ? listing.rentPrice : '';
    document.getElementById('fRentPeriod').value = listing.rentPeriod || 'month';
    document.getElementById('fHouseArea').value = listing.houseArea != null ? listing.houseArea : '';
    document.getElementById('fPlotArea').value = listing.plotArea != null ? listing.plotArea : '';
    document.getElementById('fBedrooms').value = listing.bedrooms != null ? listing.bedrooms : '';
    document.getElementById('fBathrooms').value = listing.bathrooms != null ? listing.bathrooms : '';
    document.getElementById('fPoolSize').value = listing.poolSize || '';
    document.getElementById('fYard').value = listing.yard || '';
    document.getElementById('fFloors').value = listing.floors != null ? listing.floors : '';
    document.getElementById('fFurnished').value = listing.furnished || '';
    document.getElementById('fGarageSpaces').value = listing.garageSpaces != null ? listing.garageSpaces : '';
    document.getElementById('fSecurity').checked = !!listing.security;
    document.getElementById('fAutoGate').checked = !!listing.autoGate;
    document.getElementById('fExtraFeatures').value = listing.extraFeatures || '';
    document.getElementById('fCommunityInfo').value = listing.communityInfo || '';
    document.getElementById('fBuildingInfo').value = listing.buildingInfo || '';
    document.getElementById('fComplexName').value = listing.complexName || '';
    document.getElementById('fBuildYear').value = listing.buildYear != null ? listing.buildYear : '';
    document.getElementById('fBuildingClass').value = listing.buildingClass || '';
    document.getElementById('fBuildingFloors').value = listing.buildingFloors != null ? listing.buildingFloors : '';
    document.getElementById('fElevators').value = listing.elevators || '';
    document.getElementById('fParking').value = listing.parking || '';
    document.getElementById('fInfrastructure').value = listing.infrastructure || '';
    document.getElementById('fNearby').value = listing.nearby || '';
    document.getElementById('fManagementCompany').value = listing.managementCompany || '';
    document.getElementById('fCamFee').value = listing.camFee != null ? listing.camFee : '';
    document.getElementById('fCleaningFee').value = listing.cleaningFee != null ? listing.cleaningFee : '';
    document.getElementById('fCleaningPeriod').value = listing.cleaningPeriod || 'week';
    document.getElementById('fPoolMaintenanceFee').value = listing.poolMaintenanceFee != null ? listing.poolMaintenanceFee : '';
    document.getElementById('fRentMarketRange').value = listing.rentMarketRange || '';
    document.getElementById('fCompanyName').value = listing.companyName || '';
    document.getElementById('fAgentName').value = listing.agentName || '';
    document.getElementById('fAgentPhone').value = listing.agentPhone || '';

    BS.photosBySlot = {};
    Object.keys(listing.photosBySlot || {}).forEach(function (k) { BS.photosBySlot[k] = listing.photosBySlot[k]; });
    BS.logo = listing.logo || null;
    BS.agentPhoto = listing.agentPhoto || null;
    BS.agentQr = Object.assign({}, listing.agentQr || {});

    MESSENGER_DEFS.forEach(function (m) {
      document.getElementById(m.id).checked = (listing.agentMessengers || []).indexOf(m.key) !== -1;
    });

    applyPropertyType(); // field visibility + photo slot grid, off the values just set above
    renderLogoPreview();
    renderAgentPhotoPreview();
    renderQrUploaders();
    if (window.BSI18n) window.BSI18n.apply();
    updateRequiredHighlights();
  }

  /* ---------------- Form submit ---------------- */

  var form = document.getElementById('listingForm');
  var formError = document.getElementById('formError');
  var fAgentPhoneError = document.getElementById('fAgentPhoneError');
  document.getElementById('fAgentPhone').addEventListener('input', function () {
    fAgentPhoneError.classList.remove('visible');
  });

  /* PDPA consent (see privacy.html) — required before any personal data
     (name, phone, photos) leaves the form, same "block submission, show
     inline error" pattern as fAgentPhone above. novalidate is set on the
     form (every other required field is checked here in JS too), so a
     plain `required` attribute on the checkbox wouldn't do anything on
     its own. */
  function wireReadToEndConsent(opts) {
    var checkboxEl = opts.checkboxEl;
    var errorEl = opts.errorEl;
    var modalEl = opts.modalEl;
    var frameEl = opts.frameEl;
    var hintEl = opts.hintEl;
    var linkEl = opts.linkEl;
    var hasRead = false;

    checkboxEl.addEventListener('change', function () {
      errorEl.classList.remove('visible');
    });

    // checkboxEl starts disabled (see index.html) — the only way to enable
    // it is to open modalEl and scroll frameEl's document all the way to
    // its end at least once. hasRead persists for the rest of the page
    // session once true — closing and reopening the modal doesn't make the
    // agent re-scroll.
    // Unlocks the checkbox once the agent has scrolled the policy to its
    // end — it stays unchecked: consent has to be the agent's own
    // deliberate click, not something reading the text does for them.
    function markRead() {
      if (hasRead) return;
      hasRead = true;
      checkboxEl.disabled = false;
      hintEl.textContent = window.BSI18n.t(opts.hintReadKey);
      hintEl.classList.add('is-read');
    }

    function checkScroll() {
      var win = frameEl.contentWindow;
      var doc = win && win.document && win.document.documentElement;
      // While modalEl is [hidden] (display:none), the iframe isn't laid out
      // at all — scrollHeight/innerHeight would both read as 0, which would
      // wrongly look "not scrollable" and mark it read before the agent
      // ever saw it. Only trust these numbers once the modal is actually
      // visible (see the click handler below, which re-checks via
      // requestAnimationFrame right after un-hiding it).
      if (!doc || modalEl.hidden) return;
      // No scrollbar at all (short viewport/zoomed-out) counts as "read"
      // too — there's nothing more to scroll to.
      var notScrollable = doc.scrollHeight <= win.innerHeight + 4;
      var atBottom = notScrollable || (win.scrollY + win.innerHeight >= doc.scrollHeight - 4);
      if (atBottom) markRead();
    }

    // The iframe starts loading the instant the parser reaches it — well
    // before this deferred script runs — so its 'load' event may already
    // have fired by now and would never be seen. contentWindow itself
    // exists synchronously regardless of load state, so attach directly
    // instead of waiting on 'load'; the 'load' listener stays as a fallback
    // for a slow/cross-document reload (addEventListener with the same
    // function reference is a no-op if already attached, so this can't
    // double-fire).
    function attachScrollListener() {
      if (frameEl.contentWindow) frameEl.contentWindow.addEventListener('scroll', checkScroll);
    }
    attachScrollListener();
    frameEl.addEventListener('load', attachScrollListener);

    linkEl.addEventListener('click', function (e) {
      e.preventDefault(); // opens the modal instead of navigating away; right-click "open in new tab" still uses the real href
      modalEl.hidden = false;
      // Layout only settles once the modal is actually visible — check on
      // the next frame rather than synchronously.
      requestAnimationFrame(checkScroll);
    });
  }

  var fConsentEl = document.getElementById('fConsent');
  var fConsentError = document.getElementById('fConsentError');
  var policyModalEl = document.getElementById('policyModal');
  wireReadToEndConsent({
    checkboxEl: fConsentEl,
    errorEl: fConsentError,
    modalEl: policyModalEl,
    frameEl: document.getElementById('policyFrame'),
    hintEl: document.getElementById('policyModalHint'),
    linkEl: document.getElementById('fConsentPolicyLink'),
    hintReadKey: 'policyModalHintRead',
  });
  document.getElementById('policyModalClose').addEventListener('click', function () {
    policyModalEl.hidden = true;
  });

  /* Second checkbox: the actual PDPA processing consent, kept separate from
     the policy-agreement checkbox above per the site owner's request. Stays
     disabled (and gets unchecked) until fConsent is checked — agreeing to
     the policy is a precondition for the processing consent to mean
     anything, so it can't be ticked out of order. */
  var fDataConsentEl = document.getElementById('fDataConsent');
  var fDataConsentError = document.getElementById('fDataConsentError');
  function syncDataConsentAvailability() {
    var unlocked = fConsentEl.checked;
    fDataConsentEl.disabled = !unlocked;
    if (!unlocked) fDataConsentEl.checked = false;
  }
  fConsentEl.addEventListener('change', syncDataConsentAvailability);
  syncDataConsentAvailability();
  fDataConsentEl.addEventListener('change', function () {
    fDataConsentError.classList.remove('visible');
  });

  function val(id) { return document.getElementById(id).value.trim(); }
  function num(id) { var v = val(id); return v === '' ? null : Number(v); }
  function bool(id) { return document.getElementById(id).checked; }

  /* ---------------- Required-field highlighting ----------------
     Runs live (on every keystroke via the form-wide 'input' listener below,
     and once on initial load/populate) rather than only after a failed
     submit attempt — the agent sees straight away which of the few
     required fields are still empty, instead of discovering it only after
     clicking "Создать презентацию" and getting a wall of red. The glow
     itself (.field-required-missing / -label, css/style.css) uses a
     dedicated warning color distinct from the site's muted editorial
     accent specifically so it reads as "unfinished" at a glance. */
  var REQUIRED_FIELD_IDS = ['fTitle', 'fAgentName', 'fAgentPhone'];

  function setFieldMissing(id, isMissing) {
    var el = document.getElementById(id);
    el.classList.toggle('field-required-missing', isMissing);
    var label = document.querySelector('label[for="' + id + '"]');
    if (label) label.classList.toggle('field-required-missing-label', isMissing);
  }

  function updateRequiredHighlights() {
    var missing = REQUIRED_FIELD_IDS.filter(function (id) { return val(id) === ''; });
    var salePrice = num('fSalePrice');
    var rentPrice = num('fRentPrice');
    var missingPrice = salePrice === null && rentPrice === null;

    REQUIRED_FIELD_IDS.forEach(function (id) { setFieldMissing(id, missing.indexOf(id) !== -1); });
    setFieldMissing('fSalePrice', missingPrice);
    setFieldMissing('fRentPrice', missingPrice);

    return { missing: missing, salePrice: salePrice, rentPrice: rentPrice, missingPrice: missingPrice };
  }

  form.addEventListener('input', updateRequiredHighlights);
  updateRequiredHighlights();

  /* Creating a listing is always free and unrestricted. Editing an existing
     one just needs its owning phone number to match (see handleListingEditAuth
     / handleCreateListing's ownership check in server.js). */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var state = updateRequiredHighlights();
    fAgentPhoneError.classList.toggle('visible', state.missing.indexOf('fAgentPhone') !== -1);

    var consentMissing = !fConsentEl.checked;
    fConsentError.classList.toggle('visible', consentMissing);
    var dataConsentMissing = !fDataConsentEl.checked;
    fDataConsentError.classList.toggle('visible', dataConsentMissing);

    if (state.missing.length || state.missingPrice || consentMissing || dataConsentMissing) {
      formError.classList.add('visible');
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    formError.classList.remove('visible');

    finishSubmit(state.salePrice, state.rentPrice);
  });

  function finishSubmit(salePrice, rentPrice) {
    // Carry the id (and finalize state) of whatever was open before this
    // submit — same-session re-edits (form -> preview -> "← Редактировать"
    // -> form -> submit again) update that one listing in place instead of
    // spawning a new /p/<id> each time. A first-ever submit has no prior
    // BS.listing, so existingId is undefined and persistListing() below
    // creates a fresh row.
    var existingId = BS.listing && BS.listing.id;
    BS.listing = {
      // The listing's edit_token, proving this save is really its owner —
      // see server.js handleCreateListing/0010_edit_token.sql. Only
      // meaningful on a re-edit; a brand new listing has no token yet, the
      // server mints one and hands it back in the response instead (see
      // persistListing below). Read off currentEditToken, not the URL
      // directly — "← Редактировать" (deckBackBtn) navigates to
      // /new-listing first, which drops the ?t= query string.
      editToken: existingId ? currentEditToken : null,
      // Fixed server-side at creation only (see 0005_language_and_edit_lockdown.sql
      // — an update's PATCH body never includes this key) — sent on every
      // submit anyway since a *new* listing needs it from its very first save.
      language: window.BSI18n ? window.BSI18n.getLang() : 'ru',
      propertyType: val('fPropertyType'),
      floorNumber: num('fFloorNumber'),
      title: val('fTitle'),
      description: val('fDescription'),
      emotionPhrase: val('fEmotionPhrase'),
      closingPhrase: val('fClosingPhrase'),
      locationName: val('fLocationName'),
      lat: num('fLat'),
      lng: num('fLng'),
      country: val('fCountry'),
      currency: val('fCurrency'),
      salePrice: salePrice,
      rentPrice: rentPrice,
      rentPeriod: val('fRentPeriod'),
      houseArea: num('fHouseArea'),
      plotArea: num('fPlotArea'),
      bedrooms: num('fBedrooms'),
      bathrooms: num('fBathrooms'),
      poolSize: val('fPoolSize'),
      yard: val('fYard'),
      floors: num('fFloors'),
      furnished: val('fFurnished'),
      garageSpaces: num('fGarageSpaces'),
      security: bool('fSecurity'),
      autoGate: bool('fAutoGate'),
      extraFeatures: val('fExtraFeatures'),
      communityInfo: val('fCommunityInfo'),
      buildingInfo: val('fBuildingInfo'),
      complexName: val('fComplexName'),
      buildYear: num('fBuildYear'),
      buildingClass: val('fBuildingClass'),
      buildingFloors: num('fBuildingFloors'),
      elevators: val('fElevators'),
      parking: val('fParking'),
      infrastructure: val('fInfrastructure'),
      nearby: val('fNearby'),
      managementCompany: val('fManagementCompany'),
      camFee: num('fCamFee'),
      cleaningFee: num('fCleaningFee'),
      cleaningPeriod: val('fCleaningPeriod'),
      poolMaintenanceFee: num('fPoolMaintenanceFee'),
      rentMarketRange: val('fRentMarketRange'),
      companyName: val('fCompanyName'),
      photosBySlot: Object.assign({}, BS.photosBySlot),
      logo: BS.logo,
      agentName: val('fAgentName'),
      agentPhone: val('fAgentPhone'),
      agentPhoto: BS.agentPhoto,
      agentMessengers: selectedMessengers(),
      agentQr: Object.assign({}, BS.agentQr),
    };
    if (existingId) { BS.listing.id = existingId; editAuthorizedListingId = existingId; }

    navigate('/preview');
    persistListing(BS.listing);
  }

  /* Saves the listing to the server (which uploads photos to Supabase
     Storage and inserts or, when listing.id is already set, updates the
     row — see POST /api/listings in server.js) so it gets a durable id and
     a shareable /p/<id> link, in the background, without blocking or
     re-rendering the preview that's already on screen. If this fails
     (server not configured, no Supabase env vars set yet, network hiccup)
     the agent still gets their instant local /preview — it just isn't
     shareable yet. Same fail-open philosophy used throughout this file.

     A 403 means the submitted phone number doesn't match the one this
     listing was created with (server-side ownership check — this
     shouldn't normally happen since the edit form itself is gated behind
     typing that exact phone, see the edit-auth modal, but a second tab or
     a since-changed phone can still race it). */
  function persistListing(listing) {
    listing._persistError = null;
    fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listing),
    }).then(function (res) {
      if (res.status === 403) {
        var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
        showInfoModal(t('finalizeError'));
        return null;
      }
      // A non-403 failure (e.g. the server's Supabase env vars aren't set)
      // leaves listing.id unset forever, not just "for now" — recorded here
      // so requestFinalize below can tell a real, permanent failure apart
      // from a save that's merely still in flight, instead of telling the
      // agent to "wait a couple seconds" indefinitely.
      if (!res.ok) { listing._persistError = 'http_' + res.status; return null; }
      return res.json();
    }).then(function (data) {
      if (!data || !data.id) return;
      if (BS.listing !== listing) return; // agent already navigated away/edited again
      listing.id = data.id;
      listing.isFinalized = !!data.isFinalized;
      // This tab just created/edited it through the real form (which
      // requires typing the agent phone in) — that already proves
      // ownership as well as the /edit/<id> phone gate would, so mark it
      // authorized now rather than making a same-tab reload re-prompt.
      markEditAuthorized(data.id);
      editAuthorizedListingId = data.id;
      if (data.editToken) { listing.editToken = data.editToken; currentEditToken = data.editToken; }
      rememberMyListing(listing, currentEditToken);
      if (location.pathname.startsWith('/preview')) {
        // data.editToken only ever arrives on a fresh create (server.js) —
        // this is the one moment the agent's browser learns their listing's
        // real edit secret, so it has to land in the address bar now or
        // it's gone (no login system to hand it back to them later).
        history.replaceState(null, '', '/edit/' + data.id + (data.editToken ? '?t=' + data.editToken : ''));
      }
    }).catch(function (err) {
      listing._persistError = 'network';
      console.warn('persistListing failed (preview still works locally):', err);
    });
  }

  /* ---------------- Language switch ---------------- */
  /* Lives on the landing page (language choice happens before the form),
     but re-renders whichever view is current so a mid-form switch (e.g.
     back-navigating to "/") still lands correctly translated. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-btn');
    if (!btn || !window.BSI18n) return;
    window.BSI18n.setLang(btn.getAttribute('data-lang'));
    renderPhotoSlotsUI();
    renderLogoPreview();
    renderMyListings();
    renderRoute();
  });

  renderMyListings();
  syncPropertyTypeOptions();
  applyPropertyType();
  renderLogoPreview();
  if (window.BSI18n) window.BSI18n.apply();
})();
