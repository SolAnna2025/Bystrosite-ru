/* ============================================================
   Быстросайт — /preview slide deck renderer.
   Architectural-editorial deck built from BS.listing (set by
   js/app.js). Fixed 1920x1080 (16:9) stage, scaled uniformly to
   fit the viewport (js fit()) so it reads the same on a phone and
   a wide screen.

   i18n: every fixed chrome string (kickers, spec labels, buttons)
   is pulled from js/i18n.js's t() at build time — buildSlides() is
   re-run on every render/language switch, so nothing is cached in
   the wrong language. A listing's own content (title, description,
   address, agent name...) is whatever the agent typed and is never
   translated.
   ============================================================ */

window.BSDeck = (function () {
  'use strict';

  function t(key, vars) { return window.BSI18n ? window.BSI18n.t(key, vars) : key; }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    // textContent->innerHTML escapes &/</> but not quotes — every call site
    // below splices the result into a double- or single-quoted HTML
    // attribute (alt="...", data-*="..."), so an unescaped quote in agent
    // content (e.g. the listing title) would break out of the attribute.
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmt(n) {
    return Number(n).toLocaleString((window.BSI18n && window.BSI18n.getLang() === 'en') ? 'en-US' : 'ru-RU');
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function cityOf(locationName) {
    if (!locationName) return '';
    return locationName.split(',')[0].trim();
  }

  function wordCap(str, maxWords) {
    if (!str) return '';
    var words = str.trim().split(/\s+/);
    if (words.length <= maxWords) return str.trim();
    return words.slice(0, maxWords).join(' ') + '…';
  }

  function parseNearby(text) {
    if (!text) return [];
    return text.split('\n').map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
      var parts = line.split(/\s+[—-]\s+/);
      return { name: parts[0].trim(), dist: parts.length > 1 ? parts.slice(1).join(' — ').trim() : '' };
    }).slice(0, 10);
  }

  /* rentPeriod/furnished are stored as semantic keys ('month'/'day',
     'full'/'partial'/'none') rather than display text, precisely so they
     can be relabelled on a language switch without touching listing data. */
  function rentPeriodLabel(period) {
    return period === 'day' ? t('optPerDay') : t('optPerMonth');
  }
  function cleaningPeriodLabel(period) {
    if (period === 'week') return t('optPerWeek');
    if (period === 'year') return t('optPerYear');
    return t('optPerMonth');
  }
  function furnishedLabel(v) {
    if (v === 'full') return t('optFurnishedFull');
    if (v === 'partial') return t('optFurnishedPartial');
    if (v === 'none') return t('optFurnishedEmpty');
    return v || '';
  }

  function media(photo, alt) {
    if (photo) return '<img class="ph-img" src="' + photo.dataUrl + '" alt="' + esc(alt) + '">';
    return '<div class="ph-placeholder"><span class="ph-placeholder-label">' + esc(t('photoPlaceholder')) + '</span></div>';
  }

  function pageNumber(n, total, pos) {
    return '<span class="pg-number ' + (pos || 'pg-number-br') + '">' + pad2(n) + ' / ' + pad2(total) + '</span>';
  }

  /* ---------------- Photos ---------------- */
  /* Every photo lives in a named slot (js/slots.js) uploaded via the
     matching tile in the /new-listing form — no positional pooling,
     so a slot always lands on the exact spot it was labelled for. */
  function getPhoto(l, key) {
    return (l.photosBySlot && l.photosBySlot[key]) || null;
  }

  /* ---------------- Slide builders ---------------- */

  function slideCover(l, n, total) {
    var city = cityOf(l.locationName);
    return {
      label: t('deckCoverLabel'),
      cls: 'slide-cover slide-on-photo',
      html:
        '<div class="ph-media" style="position:absolute;inset:0">' + media(getPhoto(l, 'cover'), l.title) + '<div class="ph-scrim-bottom"></div></div>' +
        '<div class="slide-pad">' +
          '<div class="ed-kicker">' + esc(t('deckResidence')) + (city ? ' · ' + esc(city.toUpperCase()) : '') + '</div>' +
          '<h1 class="ed-title">' + esc(l.title) + '</h1>' +
          '<hr class="ed-rule">' +
        '</div>' +
        pageNumber(n, total),
    };
  }

  function slideLiving(l, n) {
    var photo = getPhoto(l, 'living');
    var body = wordCap(l.description, 18);
    var specs = [];
    specs.push({ label: t('deckSpecHouse'), value: l.houseArea + ' ' + t('unitSqm') });
    if (l.plotArea != null) specs.push({ label: t('deckSpecPlot'), value: l.plotArea + ' ' + t('unitSqm') });
    specs.push({ label: t('deckSpecBedrooms'), value: String(l.bedrooms) });
    specs.push({ label: t('deckSpecBathrooms'), value: String(l.bathrooms) });
    if (l.poolSize) specs.push({ label: t('deckSpecPool'), value: l.poolSize });
    if (l.yard) specs.push({ label: t('deckSpecYard'), value: l.yard });
    if (l.propertyType === 'apartment') {
      if (l.floorNumber != null) specs.push({ label: t('deckSpecFloor'), value: String(l.floorNumber) });
    } else if (l.floors != null) {
      specs.push({ label: t('deckSpecFloors'), value: String(l.floors) });
    }
    if (l.furnished) specs.push({ label: t('deckSpecFurnished'), value: furnishedLabel(l.furnished) });
    if (l.garageSpaces != null) specs.push({ label: t('deckSpecGarage'), value: l.garageSpaces + ' ' + t('deckSpecGarageUnit') });
    if (l.security) specs.push({ label: t('deckSpecSecurity'), value: t('deckSpecSecurityVal') });
    if (l.autoGate) specs.push({ label: t('deckSpecGate'), value: t('deckSpecGateVal') });
    if (l.managementCompany) specs.push({ label: t('deckSpecManagement'), value: l.managementCompany });

    var specRows = specs.map(function (s) {
      return '<div class="spec-row"><span class="sr-label">' + esc(s.label) + '</span><span class="sr-value">' + esc(s.value) + '</span></div>';
    }).join('');

    return {
      label: t('deckSpaceLabel'),
      cls: 'slide-living',
      html:
        '<div class="ph-media">' + media(photo, t('deckLivingAlt')) + '</div>' +
        '<div class="living-text">' +
          '<span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckSpaceKicker')) + '</span>' +
          '<h2 class="ed-title ed-title-md ed-title-2l">' + esc(t('deckSpaceTitleL1')) + '<br>' + esc(t('deckSpaceTitleL2')) + '</h2>' +
          (body ? '<p class="ed-body">' + esc(body) + '</p>' : '') +
          '<div class="spec-grid">' + specRows + '</div>' +
          (l.extraFeatures ? '<div class="extra-features"><span class="ef-label">' + esc(t('deckExtraLabel')) + '</span><p>' + esc(l.extraFeatures) + '</p></div>' : '') +
        '</div>',
    };
  }

  function slideEmotion(l, n, total) {
    var photo = getPhoto(l, 'emotion');
    var phrase = (l.emotionPhrase || '').trim();
    return {
      label: t('deckEmotionLabel'),
      cls: 'slide-emotion slide-on-photo',
      html:
        '<div class="ph-media" style="position:absolute;inset:0">' + media(photo, l.title) + '<div class="ph-scrim-full"></div><div class="ph-scrim-bottom"></div></div>' +
        '<div class="slide-pad">' +
          (phrase ? '<p class="ed-phrase">' + esc(phrase) + '</p>' : '') +
        '</div>' +
        pageNumber(n, total),
    };
  }

  /* Architecture always shows facade1+facade2; facade3/facade4 join in only
     when filled, so a listing with little or no interior (rough-finish /
     "черновая отделка") can lean on more exterior shots here instead. */
  function slideArchitecture(l, n) {
    var keys = ['facade1', 'facade2', 'facade3', 'facade4'];
    var shown = keys.filter(function (k, i) { return i < 2 || getPhoto(l, k); });
    var photosHtml = shown.map(function (k) {
      return '<div class="ph-media">' + media(getPhoto(l, k), l.title + t('deckFacadeSuffix')) + '</div>';
    }).join('');
    return {
      label: t('deckArchitectureLabel'),
      cls: 'slide-split-a',
      html:
        '<div class="split-head"><span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckArchitectureLabel')) + '</span></div>' +
        '<div class="split-photos split-photos-' + shown.length + '">' + photosHtml + '</div>',
    };
  }

  function buildingClassLabel(v) {
    if (v === 'economy') return t('optBuildingClassEconomy');
    if (v === 'comfort') return t('optBuildingClassComfort');
    if (v === 'business') return t('optBuildingClassBusiness');
    if (v === 'premium') return t('optBuildingClassPremium');
    return v || '';
  }

  /* Conditional: only included in buildSlides() at all when at least one of
     these fields is filled in (see buildingShown there) — an agent working
     on a standalone house with no managed complex around it just never
     fills in "О доме / ЖК" and this slide quietly doesn't exist. */
  function slideBuilding(l, n) {
    var specs = [];
    if (l.complexName) specs.push({ label: t('deckSpecComplexName'), value: l.complexName });
    if (l.buildYear != null) specs.push({ label: t('deckSpecBuildYear'), value: String(l.buildYear) });
    if (l.buildingClass) specs.push({ label: t('deckSpecBuildingClass'), value: buildingClassLabel(l.buildingClass) });
    if (l.buildingFloors != null) specs.push({ label: t('deckSpecBuildingFloors'), value: String(l.buildingFloors) });
    if (l.elevators) specs.push({ label: t('deckSpecElevators'), value: l.elevators });
    if (l.parking) specs.push({ label: t('deckSpecParking'), value: l.parking });

    var specRows = specs.map(function (s) {
      return '<div class="spec-row"><span class="sr-label">' + esc(s.label) + '</span><span class="sr-value">' + esc(s.value) + '</span></div>';
    }).join('');

    return {
      label: t('deckBuildingLabel'),
      cls: 'slide-conditions',
      html:
        '<div class="slide-pad">' +
          '<span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckBuildingLabel')) + '</span>' +
          (specRows ? '<div class="spec-grid">' + specRows + '</div>' : '') +
          (l.infrastructure ? '<div class="extra-features"><span class="ef-label">' + esc(t('deckInfrastructureLabel')) + '</span><p>' + esc(l.infrastructure) + '</p></div>' : '') +
        '</div>',
    };
  }

  /* Conditional: shows pool photo(s) if a pool is declared, yard/terrace
     photo(s) if only a yard is declared, or is skipped entirely (e.g. an
     apartment with neither) — see outdoorShown() below. */
  function slideOutdoor(l, n) {
    var items = [];
    if (l.poolSize) items.push({ key: 'pool', alt: t('deckOutdoorPoolAlt') });
    if (l.yard) {
      items.push({ key: 'terrace', alt: t('deckOutdoorTerraceAlt') });
      if (getPhoto(l, 'terrace2')) items.push({ key: 'terrace2', alt: t('deckOutdoorTerraceAlt') });
    }

    /* Just the kicker, no subtitle — different properties put different
       things on their grounds (pool, yard, both, or neither), so a title
       like "Pool and terrace" doesn't fit every one of them. */
    var kicker = t('deckOutdoorTerritory');

    var photosHtml = items.map(function (it) {
      return '<div class="ph-media">' + media(getPhoto(l, it.key), it.alt) + '</div>';
    }).join('');

    return {
      label: kicker,
      cls: 'slide-split-a',
      html:
        '<div class="split-head"><span class="ed-kicker">' + pad2(n) + ' — ' + esc(kicker) + '</span></div>' +
        '<div class="split-photos split-photos-' + items.length + '">' + photosHtml + '</div>',
    };
  }

  function slideDetails(l, n) {
    var a = getPhoto(l, 'detail1'), b = getPhoto(l, 'detail2'), c = getPhoto(l, 'detail3');
    var alt = t('deckDetailAlt');
    return {
      label: t('deckDetailsLabel'),
      cls: 'slide-grid3',
      html:
        '<div class="grid3-head">' +
          '<span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckDetailsLabel')) + '</span>' +
        '</div>' +
        '<div class="grid3-photos">' +
          '<div class="ph-media">' + media(a, alt) + '</div>' +
          '<div class="ph-media">' + media(b, alt) + '</div>' +
          '<div class="ph-media">' + media(c, alt) + '</div>' +
        '</div>',
    };
  }

  function roomGridCols(count) {
    if (count <= 2) return Math.max(1, count);
    if (count === 3) return 3;
    if (count === 4) return 2;
    if (count <= 6) return 3;
    return 4;
  }

  function slideRoomGallery(l, keyPrefix, count, groupTitle, itemLabel, n) {
    var items = '';
    for (var i = 1; i <= count; i++) {
      var label = itemLabel + (count > 1 ? ' ' + i : '');
      items += '<div class="rg-item">' + media(getPhoto(l, keyPrefix + i), label) + '<div class="ph-scrim-bottom"></div><span class="rg-label">' + esc(label) + '</span></div>';
    }
    var cols = roomGridCols(count);
    return {
      label: groupTitle,
      cls: 'slide-roomgrid',
      html:
        '<div class="roomgrid-head"><span class="ed-kicker">' + pad2(n) + ' — ' + esc(groupTitle) + '</span></div>' +
        '<div class="roomgrid-photos" style="grid-template-columns:repeat(' + cols + ',1fr)">' + items + '</div>',
    };
  }

  /* Interiors: a fixed 4-slot gallery (hall/kitchen/dining/extra) for
     common spaces that don't belong to any other category — separate
     from, and unaffected by, the bedroom/bathroom counts above, which
     keep sizing their own galleries dynamically. All four slots are
     optional; only the ones actually photographed render, and the
     slide itself is omitted from the deck when none are (see
     interiorsShown(), used by buildSlides() below). */
  var INTERIOR_SLOTS = [
    { key: 'interiorHall', labelKey: 'slotInteriorHall' },
    { key: 'interiorKitchen', labelKey: 'slotInteriorKitchen' },
    { key: 'interiorDining', labelKey: 'slotInteriorDining' },
    { key: 'interiorExtra', labelKey: 'slotInteriorExtra' },
  ];

  function interiorsShown(l) {
    return INTERIOR_SLOTS.some(function (s) { return !!getPhoto(l, s.key); });
  }

  function slideInteriors(l, n) {
    var filled = INTERIOR_SLOTS.filter(function (s) { return getPhoto(l, s.key); });
    var items = filled.map(function (s) {
      var label = t(s.labelKey);
      return '<div class="rg-item">' + media(getPhoto(l, s.key), label) + '<div class="ph-scrim-bottom"></div><span class="rg-label">' + esc(label) + '</span></div>';
    }).join('');
    var cols = roomGridCols(filled.length);
    return {
      label: t('deckInteriorsLabel'),
      cls: 'slide-roomgrid',
      html:
        '<div class="roomgrid-head"><span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckInteriorsLabel')) + '</span></div>' +
        '<div class="roomgrid-photos" style="grid-template-columns:repeat(' + cols + ',1fr)">' + items + '</div>',
    };
  }

  function slideLocation(l, nearby, n) {
    /* Yandex Maps, not Google/OSM — the target audience is Russian agents
       and their clients, for whom Yandex is the map people actually open
       and trust. The "map-widget" embed is Yandex's documented, no-API-key
       iframe made for exactly this (a single point on a map), same idea as
       Google's or OSM's embed. Note the coordinate order: Yandex's ll/pt
       URL params take longitude,latitude (reverse of lat/lng as stored
       everywhere else in this file) — a GIS (x,y) convention, unlike the
       lat,lon order Yandex uses when it shows coordinates to a human. */
    var mapSrc = 'https://yandex.ru/map-widget/v1/?ll=' + l.lng + ',' + l.lat + '&z=16&l=map&pt=' + l.lng + ',' + l.lat + ',pm2rdm';
    var routeUrl = 'https://yandex.ru/maps/?rtext=~' + l.lat + ',' + l.lng + '&rtt=auto';
    var rows = nearby.map(function (p) {
      return '<div class="loc-nearby-row"><span class="lnr-name">' + esc(p.name) + '</span>' + (p.dist ? '<span class="lnr-dist">' + esc(p.dist) + '</span>' : '') + '</div>';
    }).join('');
    return {
      label: t('deckLocationLabel'),
      cls: 'slide-location',
      html:
        /* data-src, not src: inactive slides are hidden via display:none, which
           collapses an iframe's layout box to 0×0 — if the map loaded eagerly
           here, Yandex's embedded map would measure that 0×0 size at init and
           never recover (no way to reach into a cross-origin iframe and call
           invalidateSize()). showSlide()/flipTo() below promote data-src to a
           real src only once this slide is about to become visible, so the
           iframe always has its true, final size the moment it starts loading. */
        '<div class="loc-map"><iframe data-src="' + esc(mapSrc) + '" title="' + esc(t('deckMapTitle')) + '" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' +
        '<div class="loc-text">' +
          '<span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckLocationLabel')) + '</span>' +
          '<h2 class="ed-title ed-title-md ed-title-2l" style="margin-top:10px">' + esc(l.locationName) + '</h2>' +
          '<div class="loc-coords">' + esc(String(l.lat)) + ', ' + esc(String(l.lng)) + '</div>' +
          (rows ? '<div class="loc-nearby-list">' + rows + '</div>' : '') +
          '<a class="loc-route" href="' + esc(routeUrl) + '" target="_blank" rel="noopener">' + esc(t('deckRouteLink')) + '</a>' +
        '</div>',
    };
  }

  function slideConditions(l, n) {
    var rows = '';
    if (l.salePrice != null) {
      rows += '<div class="cond-price-row"><span class="cp-label">' + esc(t('deckSale')) + '</span><span><span class="cp-value">' + fmt(l.salePrice) + '</span><span class="cp-unit">' + esc(l.currency) + '</span></span></div>';
    }
    if (l.rentPrice != null) {
      rows += '<div class="cond-price-row"><span class="cp-label">' + esc(t('deckRent')) + '</span><span><span class="cp-value">' + fmt(l.rentPrice) + '</span><span class="cp-unit">' + esc(l.currency) + ' ' + esc(rentPeriodLabel(l.rentPeriod)) + '</span></span></div>';
    }
    /* Cleaning is entered on whatever cadence the agent actually pays it
       (weekly/monthly/yearly) — normalize to a monthly figure once here,
       both for display and for the yield calculator below. */
    var cleaningMonthly = 0;
    if (l.cleaningFee != null) {
      var cleaningMult = l.cleaningPeriod === 'week' ? (52 / 12) : l.cleaningPeriod === 'year' ? (1 / 12) : 1;
      cleaningMonthly = l.cleaningFee * cleaningMult;
    }
    var monthlyExpenses = (l.camFee || 0) + cleaningMonthly + (l.poolMaintenanceFee || 0);

    var costs = '';
    if (l.managementCompany) costs += '<div class="cc-row"><span>' + esc(t('fManagementCompanyLabel')) + '</span><span class="cc-val">' + esc(l.managementCompany) + '</span></div>';
    if (l.camFee != null) costs += '<div class="cc-row"><span>CAM fee</span><span class="cc-val">' + fmt(l.camFee) + ' ' + esc(l.currency) + ' ' + esc(rentPeriodLabel(l.rentPeriod)) + '</span></div>';
    if (l.cleaningFee != null) costs += '<div class="cc-row"><span>' + esc(t('fCleaningFeeLabel')) + '</span><span class="cc-val">' + fmt(l.cleaningFee) + ' ' + esc(l.currency) + ' ' + esc(cleaningPeriodLabel(l.cleaningPeriod)) + '</span></div>';
    if (l.poolMaintenanceFee != null) costs += '<div class="cc-row"><span>' + esc(t('fPoolMaintenanceFeeLabel')) + '</span><span class="cc-val">' + fmt(l.poolMaintenanceFee) + ' ' + esc(l.currency) + ' ' + esc(rentPeriodLabel('month')) + '</span></div>';

    /* Rental-yield calculator: needs a purchase price as its basis, so it
       only shows up when the listing has one. Rent starts pre-filled from
       the declared rent price (if any) but stays freely editable — the
       client can play with either number and watch yield/payback update.
       Expenses (CAM fee, cleaning, pool maintenance) come from the form,
       not from calculator inputs — recalculated live but not user-edited
       here, since they're already the listing's own declared costs. */
    var calc = '';
    if (l.salePrice != null) {
      calc =
        '<div class="cond-calc">' +
          (l.rentMarketRange ?
            '<div class="cond-market"><span class="cm-label">' + esc(t('deckMarketRentPrefix')) + '</span><span class="cm-value">' + esc(l.rentMarketRange) + '</span></div>'
            : '') +
          '<div class="calc-box" data-monthly-expenses="' + monthlyExpenses + '">' +
            '<div class="calc-inputs">' +
              '<label class="calc-field"><span class="calc-field-label">' + esc(t('calcPurchasePrice')) + '</span><span class="calc-input-wrap"><input type="number" id="calcPrice" min="0" value="' + esc(String(l.salePrice)) + '"><span class="calc-print-value"></span><span class="calc-unit">' + esc(l.currency) + '</span></span></label>' +
              '<label class="calc-field"><span class="calc-field-label">' + esc(t('calcRentLabel')) + ' ' + esc(rentPeriodLabel(l.rentPeriod)) + '</span><span class="calc-input-wrap"><input type="number" id="calcRent" min="0" data-period="' + esc(l.rentPeriod === 'day' ? 'day' : 'month') + '" value="' + esc(l.rentPrice != null ? String(l.rentPrice) : '') + '"><span class="calc-print-value"></span><span class="calc-unit">' + esc(l.currency) + '</span></span></label>' +
            '</div>' +
            (monthlyExpenses > 0 ?
              '<div class="calc-expenses"><span class="calc-expenses-label">' + esc(t('calcExpensesLabel')) + '</span><span class="calc-expenses-value">' + fmt(Math.round(monthlyExpenses)) + ' ' + esc(l.currency) + ' ' + esc(rentPeriodLabel('month')) + '</span></div>'
              : '') +
            '<div class="calc-results">' +
              '<div class="calc-result calc-result-primary"><span class="cr-label">' + esc(monthlyExpenses > 0 ? t('calcNetYieldLabel') : t('calcYieldLabel')) + '</span><span class="cr-value" id="calcYield">—</span></div>' +
              '<div class="calc-result calc-result-primary"><span class="cr-label">' + esc(t('calcPaybackLabel')) + '</span><span class="cr-value" id="calcPayback">—</span></div>' +
              (monthlyExpenses > 0 ?
                '<div class="calc-result calc-result-secondary"><span class="cr-label">' + esc(t('calcGrossYieldLabel')) + '</span><span class="cr-value" id="calcGrossYield">—</span></div>'
                : '') +
            '</div>' +
          '</div>' +
        '</div>';
    }

    return {
      label: t('deckConditionsLabel'),
      cls: 'slide-conditions',
      html:
        '<div class="slide-pad">' +
          '<span class="ed-kicker">' + pad2(n) + ' — ' + esc(t('deckConditionsLabel')) + '</span>' +
          '<div class="cond-body">' +
            '<div class="cond-price">' + rows + '</div>' +
            (costs ? '<div class="cond-costs"><div class="cc-title">' + esc(t('deckMonthly')) + '</div>' + costs + '</div>' : '') +
          '</div>' +
          calc +
        '</div>',
    };
  }

  var MESSENGER_LABELS = { whatsapp: 'WhatsApp', telegram: 'Telegram', max: 'MAX' };

  /* Agent name/phone/photo/messengers/QR all come from the listing now —
     entered once in the /new-listing form (see index.html "Контакты
     агента" section and js/app.js) — rather than edited a second time
     here on the slide. One data source, one place to fill it in. */
  function slideFinal(l, n, total) {
    var closing = (l.closingPhrase || '').trim();
    var agentName = (l.agentName || '').trim();
    var agentPhone = (l.agentPhone || '').trim();
    var messengers = (l.agentMessengers || []).slice(0, 2);
    var qrsHtml = messengers.map(function (key) {
      var qrData = l.agentQr && l.agentQr[key];
      return '<div class="cb-qr">' + (qrData
        ? '<img src="' + esc(qrData) + '" alt="' + esc(t('qrLabel') + (MESSENGER_LABELS[key] || key)) + '">'
        : '<span class="qr-label">' + esc(t('qrLabel') + (MESSENGER_LABELS[key] || key)) + '</span>') + '</div>';
    }).join('');
    var msgPillsHtml = messengers.map(function (key) {
      return '<span class="msg-pill active">' + esc(MESSENGER_LABELS[key] || key) + '</span>';
    }).join('');
    return {
      label: t('deckContactsLabel'),
      cls: 'slide-final slide-on-photo',
      html:
        '<div class="cf-photo-area">' +
          '<div class="ph-media" style="position:absolute;inset:0">' + media(getPhoto(l, 'final'), l.title + t('deckEveningSuffix')) + '<div class="ph-scrim-bottom"></div></div>' +
          (closing ? '<div class="cf-phrase-wrap"><p class="ed-phrase">' + esc(closing) + '</p></div>' : '') +
          pageNumber(n, total, 'pg-number-tl') +
        '</div>' +
        '<div class="contact-bar">' +
          '<div class="cb-photo">' +
            (l.agentPhoto
              ? '<div class="cb-photo-mask"><img src="' + esc(l.agentPhoto) + '" alt="' + esc(t('agentPhotoAlt')) + '"></div>'
              : '<span class="ph-label">' + esc(t('photoPlaceholder')) + '</span>') +
          '</div>' +
          '<div class="cb-info">' +
            (agentName ? '<span class="cb-name">' + esc(agentName) + '</span>' : '') +
            (agentPhone ? '<span class="cb-phone">' + esc(agentPhone) + '</span>' : '') +
            (msgPillsHtml ? '<div class="cb-messengers">' + msgPillsHtml + '</div>' : '') +
          '</div>' +
          (qrsHtml ? '<div class="cb-qrs">' + qrsHtml + '</div>' : '') +
        '</div>',
    };
  }

  function buildSlides(l) {
    var nearby = parseNearby(l.nearby);
    var bedroomsN = Math.max(0, Math.floor(Number(l.bedrooms) || 0));
    var bathroomsN = Math.max(0, Math.floor(Number(l.bathrooms) || 0));
    var outdoorShown = !!(l.poolSize || l.yard);
    var interiorsN = interiorsShown(l);
    var buildingShown = !!(l.complexName || l.buildYear != null || l.buildingClass || l.buildingFloors != null || l.elevators || l.parking || l.infrastructure);
    var total = 5 + (outdoorShown ? 1 : 0) + (interiorsN ? 1 : 0) + (bedroomsN > 0 ? 1 : 0) + (bathroomsN > 0 ? 1 : 0) + (buildingShown ? 1 : 0) + 3;

    var n = 0;
    var slides = [
      slideCover(l, ++n, total),
      slideEmotion(l, ++n, total),
      slideLiving(l, ++n),
      slideArchitecture(l, ++n),
    ];
    if (buildingShown) slides.push(slideBuilding(l, ++n));
    if (outdoorShown) slides.push(slideOutdoor(l, ++n));
    slides.push(slideDetails(l, ++n));
    if (interiorsN) slides.push(slideInteriors(l, ++n));
    if (bedroomsN > 0) slides.push(slideRoomGallery(l, 'bedroom', bedroomsN, t('deckBedroomsGroup'), t('deckBedroomLabel'), ++n));
    if (bathroomsN > 0) slides.push(slideRoomGallery(l, 'bathroom', bathroomsN, t('deckBathroomsGroup'), t('deckBathroomLabel'), ++n));
    slides.push(
      slideLocation(l, nearby, ++n),
      slideConditions(l, ++n),
      slideFinal(l, ++n, total)
    );
    return slides;
  }

  /* ---------------- Deck runtime (fit-to-screen + nav) ---------------- */

  var stage, stageOuter, btnPrev, btnNext, deckCount, deckLabel, deckProgress, deckAnnounce;
  var slidesEls = [];
  var currentListing = null; // last-rendered listing — just for the PDF filename
  var idx = 0;
  var wired = false;
  var animating = false;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fit() {
    var vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
    var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    // Capped at 1: on a large/high-res monitor (vw/vh past 1920x1080), a
    // scale above 1 would upscale every photo past its native resolution
    // (blurry) *and* grow the stage's own real-pixel footprint past what
    // the fixed-position nav chrome (css/deck.css .deck-actions etc.) was
    // given clearance for — without this cap, a wide enough window can
    // always eventually push .global-logo back under the Share/PDF
    // buttons no matter how much clearance .deck-actions is given, since
    // one grows with the stage and the other doesn't. Capping means that
    // clearance only ever has to cover *one* concrete pixel size (the
    // stage at its native 1:1), not an unbounded one — same margin
    // computed once, safe forever.
    var s = Math.min(vw / 1920, vh / 1080, 1);
    stage.style.transform = 'scale(' + s + ')';
  }

  /* Inactive slides are hidden with display:none — cheap, and correct for
     ordinary slides (no layout/paint work, images don't decode). The one
     slide that needs a real layout size *before* it's shown is Location's
     Yandex Maps iframe: it lazy-loads via data-src (see slideLocation)
     precisely so it's never inserted while its container is display:none —
     activateLazyIframes() promotes data-src to src right as a slide
     becomes active, when its box already has its true final size. */
  function activateLazyIframes(el) {
    Array.prototype.forEach.call(el.querySelectorAll('iframe[data-src]'), function (f) {
      f.src = f.getAttribute('data-src');
      f.removeAttribute('data-src');
    });
  }

  /* Ken Burns trigger, applied directly to the img rather than through a CSS
     class selector (see the comment above .ph-media img's transform-origin
     rule in deck.css for why: an .active-gated CSS rule hit a Chromium
     style-matching quirk where the parsed-at-load rule never re-applied once
     .active was added later). Called exactly when a slide becomes genuinely
     visible to the viewer: from showSlide() (initial render, and the
     reduced-motion nav path, where there's no flip to wait out) and from
     flipTo()'s onEnd (the normal page-turn nav path, once it's finished). */
  function armKenBurns(el) {
    if (reduceMotion) return;
    var img, name;
    if (el.classList.contains('slide-cover')) { img = el.querySelector('.ph-media img'); name = 'kbZoomIn'; }
    else if (el.classList.contains('slide-final')) { img = el.querySelector('.cf-photo-area .ph-media img'); name = 'kbZoomIn'; }
    else if (el.classList.contains('slide-emotion')) { img = el.querySelector('.ph-media img'); name = 'kbZoomOut'; }
    if (!img) return;
    img.style.animation = 'none';
    void img.offsetWidth; // restart cleanly even on a revisit
    img.style.animation = name + ' 10s ease-out forwards';
  }

  /* ---------------- PDF export ----------------
     Not window.print(): Chrome's native print-to-PDF re-rasterizes every
     photo losslessly regardless of source size or format — measured, on
     this deck's demo listing, at 50MB+ even after pre-shrinking every
     source image to ~2MB total, because the print pipeline doesn't
     re-encode as JPEG, it embeds a lossless bitmap of whatever it composes.
     No parameter (scale, paper size, backgrounds) changes that materially.
     Rasterizing each slide with html2canvas and compressing *that* bitmap
     ourselves as JPEG (the actual compression step Chrome's print pipeline
     was skipping) is what actually controls file size, because we choose
     the encoding instead of inheriting whatever the print pipeline embeds.
     One consequence: the Location slide's map is a cross-origin Yandex Maps
     iframe, and html2canvas — like any canvas-based capture — cannot read
     into cross-origin iframe content at all. It's swapped for a plain
     text fallback (still showing the coordinates and nearby list, which
     aren't images) for the duration of that slide's capture only. */
  function ensureLoaded(img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function (resolve) {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }

  /* Tries the same-origin static-map proxy (server.js /api/static-map,
     backed by Yandex Static Maps — see its comment for why it's proxied
     rather than called with a key straight from the browser) and resolves
     to the loaded <img>, or null if it 404s/errors/times out (no key
     configured on the server, offline, cold-started Render instance that
     didn't answer quickly enough — same fail-open spirit every check in
     js/app.js uses). Never rejects, so it never blocks PDF export.
     Timeout was 6s — measured ~2.5s for this same request on an already-
     warm instance, so a Render free/starter instance waking up from an
     idle spin-down (routinely 10s+) blew straight through it, silently
     swapping a real map for the text fallback on the very first PDF after
     any lull. 20s costs nothing extra when the map loads quickly (the
     promise still resolves the moment it does) and gives a cold start
     enough room to actually finish. */
  function loadStaticMapImage(lat, lng) {
    return new Promise(function (resolve) {
      var img = new Image();
      var settled = false;
      var timer = setTimeout(function () { settle(null); }, 20000);
      function settle(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
      img.onload = function () { settle(img); };
      img.onerror = function () { settle(null); };
      img.src = '/api/static-map?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng);
    });
  }

  /* html2canvas 1.4.1 (the rasterizer buildPdfDocument uses below) doesn't
     support the object-fit CSS property — a long-standing upstream gap, not
     a bug in our CSS. It draws each <img> stretched to fill its box at the
     image's own aspect ratio, so photos that crop cleanly on-screen via
     object-fit:cover come out distorted in the exported PDF. Fix: before
     capture, pre-crop each cover-fit photo on an offscreen canvas sized to
     its actual rendered box — the same center-crop math the browser applies
     for object-fit:cover — and swap the <img> src to that. By the time
     html2canvas sees it, the cropping has already happened, so its plain
     stretch-to-fit draw reproduces exactly what the browser shows. */
  function cropCoverImageForPdf(img) {
    var boxW = img.offsetWidth, boxH = img.offsetHeight;
    if (!boxW || !boxH) return Promise.resolve(null);
    return ensureLoaded(img).then(function () {
      return new Promise(function (resolve) {
        var src = new Image();
        src.crossOrigin = 'anonymous';
        src.onload = function () { resolve(src); };
        src.onerror = function () { resolve(null); };
        src.src = img.currentSrc || img.src;
      });
    }).then(function (src) {
      if (!src || !src.naturalWidth || !src.naturalHeight) return null;
      var boxRatio = boxW / boxH, imgRatio = src.naturalWidth / src.naturalHeight;
      var sx, sy, sw, sh;
      if (imgRatio > boxRatio) {
        sh = src.naturalHeight; sw = sh * boxRatio; sx = (src.naturalWidth - sw) / 2; sy = 0;
      } else {
        sw = src.naturalWidth; sh = sw / boxRatio; sx = 0; sy = (src.naturalHeight - sh) / 2;
      }
      var canvas = document.createElement('canvas');
      canvas.width = boxW; canvas.height = boxH;
      canvas.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, boxW, boxH);
      try {
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (e) {
        // Tainted canvas (image host isn't sending CORS headers) — fall back
        // to the uncropped photo rather than failing the whole export.
        return null;
      }
    });
  }

  function prepSlideForPdf(el) {
    var restore = [];
    var photoImgs = Array.prototype.slice.call(el.querySelectorAll('.ph-img, .ph-media img, .cb-photo-mask img'));
    var photosReady = Promise.all(photoImgs.map(function (img) {
      return cropCoverImageForPdf(img).then(function (croppedSrc) {
        if (!croppedSrc) return;
        var originalSrc = img.src;
        img.src = croppedSrc;
        restore.push(function () { img.src = originalSrc; });
      });
    }));
    ['calcPrice', 'calcRent'].forEach(function (id) {
      var input = el.querySelector('#' + id);
      if (!input) return;
      var printValue = input.parentElement.querySelector('.calc-print-value');
      if (!printValue) return;
      printValue.textContent = input.value ? fmt(Number(input.value)) : '—';
      var prevInputDisplay = input.style.display, prevValueDisplay = printValue.style.display;
      input.style.display = 'none';
      printValue.style.display = 'inline';
      restore.push(function () { input.style.display = prevInputDisplay; printValue.style.display = prevValueDisplay; });
    });

    var mapEl = el.querySelector('.loc-map');
    var mapReady = Promise.resolve();
    if (mapEl) {
      var frame = mapEl.querySelector('iframe');
      if (frame) frame.style.visibility = 'hidden';
      var lat = currentListing && currentListing.lat, lng = currentListing && currentListing.lng;
      mapReady = (lat != null && lng != null ? loadStaticMapImage(lat, lng) : Promise.resolve(null)).then(function (img) {
        if (img) {
          img.className = 'loc-map-pdf-img';
          img.alt = '';
          mapEl.appendChild(img);
          restore.push(function () { img.remove(); });
        } else {
          var fallback = document.createElement('div');
          fallback.className = 'loc-map-pdf-fallback';
          fallback.textContent = t('pdfMapFallback');
          mapEl.appendChild(fallback);
          restore.push(function () { fallback.remove(); });
        }
        restore.push(function () { if (frame) frame.style.visibility = ''; });
      });
    }

    return Promise.all([mapReady, photosReady]).then(function () {
      return function restoreSlide() { restore.forEach(function (fn) { fn(); }); };
    });
  }

  function captureSlideToJpeg(el) {
    var photos = Array.prototype.slice.call(el.querySelectorAll('.ph-img, .ph-media img, .cb-photo-mask img'));
    return Promise.all(photos.map(ensureLoaded)).then(function () {
      return window.html2canvas(el, {
        width: 1920, height: 1080, windowWidth: 1920, windowHeight: 1080,
        scale: 1, useCORS: true, backgroundColor: '#f6f1e7', logging: false,
      });
    }).then(function (canvas) {
      return canvas.toDataURL('image/jpeg', 0.72);
    });
  }

  /* Builds the PDF and returns the jsPDF document (not yet saved) — the
     caller decides whether to .save() it (the real button) or just inspect
     it (tests). Walks slides one at a time through the deck's own existing
     single-active-slide display model, exactly like normal navigation, so
     no separate "all slides visible at once" layout is needed. */
  function buildPdfDocument() {
    if (!window.html2canvas || !(window.jspdf && window.jspdf.jsPDF)) {
      return Promise.reject(new Error('PDF libraries failed to load'));
    }
    var savedIdx = idx;
    var prevStageTransform = stage.style.transform;
    stage.style.transform = 'none';

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080], compress: true });

    var chain = Promise.resolve();
    slidesEls.forEach(function (el, i) {
      chain = chain.then(function () {
        showSlide(i);
        return prepSlideForPdf(el).then(function (restoreSlide) {
          return captureSlideToJpeg(el).then(function (jpeg) {
            restoreSlide();
            if (i > 0) doc.addPage([1920, 1080], 'landscape');
            doc.addImage(jpeg, 'JPEG', 0, 0, 1920, 1080);
          }, function (err) {
            restoreSlide();
            throw err;
          });
        });
      });
    });

    function cleanup() {
      stage.style.transform = prevStageTransform;
      showSlide(savedIdx);
      armKenBurns(slidesEls[savedIdx]);
    }
    return chain.then(function () { cleanup(); return doc; }, function (err) { cleanup(); throw err; });
  }

  function showSlide(i) {
    slidesEls.forEach(function (s, si) {
      if (si === i) {
        s.style.display = '';
        s.classList.add('active');
        s.removeAttribute('aria-hidden');
        activateLazyIframes(s);
        armKenBurns(s);
      } else {
        s.style.display = 'none';
        s.classList.remove('active');
        s.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function updateChrome() {
    var total = slidesEls.length;
    deckCount.textContent = pad2(idx + 1) + ' / ' + pad2(total);
    deckLabel.textContent = slidesEls[idx].getAttribute('aria-label') || '';
    deckProgress.style.width = ((idx + 1) / total * 100) + '%';
    btnPrev.disabled = idx === 0 || animating;
    btnNext.disabled = idx === total - 1 || animating;
    deckAnnounce.textContent = t('slideAnnounce', { n: idx + 1, total: total, label: deckLabel.textContent });
  }

  function flipTo(nextIdx, dir) {
    animating = true;
    var fromEl = slidesEls[idx];
    var toEl = slidesEls[nextIdx];
    /* Forward: fromEl slides out to the left, toEl slides in from the
       right. Backward: mirrored — out to the right, in from the left.
       Both run at once (not one waiting behind the other, like the old
       flip did), so they pass each other in sync. */
    var outClass = dir === 1 ? 'page-slide-out-next' : 'page-slide-out-prev';
    var inClass = dir === 1 ? 'page-slide-in-next' : 'page-slide-in-prev';

    toEl.style.display = '';
    activateLazyIframes(toEl);

    void fromEl.offsetWidth; // force reflow so the animation classes transition cleanly

    function onEnd(e) {
      if (e.target !== toEl) return;
      toEl.removeEventListener('animationend', onEnd);
      fromEl.classList.remove(outClass, 'active');
      fromEl.style.display = 'none';
      toEl.classList.remove(inClass);
      toEl.classList.add('active');
      idx = nextIdx;
      animating = false;
      armKenBurns(toEl);
      updateChrome();
    }
    toEl.addEventListener('animationend', onEnd);
    fromEl.classList.add(outClass);
    toEl.classList.add(inClass);
    updateChrome();
  }

  function go(n) {
    var total = slidesEls.length;
    var next = Math.max(0, Math.min(total - 1, n));
    if (next === idx || animating) return;
    if (reduceMotion) {
      idx = next;
      showSlide(idx);
      updateChrome();
      return;
    }
    flipTo(next, next > idx ? 1 : -1);
  }

  function isEditingContext(el) {
    return !!(el && el.closest && el.closest('input, textarea'));
  }

  /* Rental-yield calculator on the Conditions slide: purchase price and
     monthly rent are both freely editable, yield %/payback recompute live. */
  function wireCalculator(root) {
    var calcBox = root.querySelector('.calc-box');
    var priceEl = root.querySelector('#calcPrice');
    var rentEl = root.querySelector('#calcRent');
    var yieldEl = root.querySelector('#calcYield');
    var paybackEl = root.querySelector('#calcPayback');
    var grossYieldEl = root.querySelector('#calcGrossYield');
    if (!priceEl || !rentEl || !yieldEl || !paybackEl) return;

    var isEn = window.BSI18n && window.BSI18n.getLang() === 'en';
    var monthlyExpenses = (calcBox && parseFloat(calcBox.getAttribute('data-monthly-expenses'))) || 0;

    function plural(n, one, few, many) {
      if (isEn) return n === 1 ? one : many;
      var mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return one;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
      return many;
    }

    /* Net yield/payback drive the primary display; gross yield (rent
       alone, no expenses deducted) only renders as a secondary
       comparison figure when the listing actually declared any CAM
       fee / cleaning / pool maintenance — see slideConditions. */
    function recalc() {
      var price = Number(priceEl.value) || 0;
      var rent = Number(rentEl.value) || 0;
      if (price <= 0 || rent <= 0) {
        yieldEl.textContent = '—';
        paybackEl.textContent = '—';
        if (grossYieldEl) grossYieldEl.textContent = '—';
        return;
      }
      var dec = isEn ? '.' : ',';
      var periodsPerYear = rentEl.getAttribute('data-period') === 'day' ? 365 : 12;
      var annualRent = rent * periodsPerYear;
      var netAnnualIncome = annualRent - monthlyExpenses * 12;
      var netYieldPct = (netAnnualIncome / price) * 100;

      yieldEl.textContent = netYieldPct.toFixed(1).replace('.', dec) + '%';
      if (netAnnualIncome > 0) {
        var paybackYears = price / netAnnualIncome;
        paybackEl.textContent = paybackYears.toFixed(1).replace('.', dec) + ' ' + plural(Math.round(paybackYears), t('calcYearOne'), t('calcYearFew'), t('calcYearMany'));
      } else {
        paybackEl.textContent = '—';
      }
      if (grossYieldEl) {
        var grossYieldPct = (annualRent / price) * 100;
        grossYieldEl.textContent = grossYieldPct.toFixed(1).replace('.', dec) + '%';
      }
    }

    priceEl.addEventListener('input', recalc);
    rentEl.addEventListener('input', recalc);
    recalc();
  }

  function wireChromeOnce() {
    if (wired) return;
    wired = true;
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', fit);
      window.visualViewport.addEventListener('scroll', fit);
    }
    if (window.ResizeObserver) new ResizeObserver(fit).observe(document.body);

    btnPrev.addEventListener('click', function () { go(idx - 1); });
    btnNext.addEventListener('click', function () { go(idx + 1); });

    /* Rasterizing 12+ slides through html2canvas is real work (seconds,
       not instant) — the busy label matters here so the click doesn't
       read as unresponsive. See buildPdfDocument() for why this isn't
       window.print(). */
    var deckPdfBtn = document.getElementById('deckPdfBtn');
    if (deckPdfBtn) deckPdfBtn.addEventListener('click', function () {
      if (deckPdfBtn.disabled) return;
      // Downloading a PDF is one of the two finalize actions (the other is
      // "Поделиться" in js/app.js) — requestFinalize checks/confirms/spends
      // whatever the agent's finalize state requires and only calls back
      // here once actually approved. See server.js handleListingFinalize.
      if (!window.BS || !window.BS.requestFinalize) { runPdfExport(); return; }
      window.BS.requestFinalize(currentListing, runPdfExport);
    });

    /* Rasterizing 12+ slides through html2canvas is real work (seconds, not
       instant) — the busy label matters here so the click doesn't read as
       unresponsive. See buildPdfDocument() for why this isn't window.print(). */
    function runPdfExport() {
      var originalLabel = deckPdfBtn.textContent;
      deckPdfBtn.disabled = true;
      deckPdfBtn.textContent = t('deckPdfPreparing');

      buildPdfDocument().then(function (doc) {
        var name = (currentListing && currentListing.title ? currentListing.title : 'presentation').replace(/[\\/:*?"<>|]+/g, ' ').trim();
        doc.save((name || 'presentation') + '.pdf');
      }, function (err) {
        console.error('PDF generation failed:', err);
        window.alert(t('deckPdfError'));
      }).then(function () {
        deckPdfBtn.disabled = false;
        deckPdfBtn.textContent = originalLabel;
      });
    }

    window.addEventListener('keydown', function (e) {
      if (document.getElementById('view-preview').hidden) return;
      if (isEditingContext(document.activeElement)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(slidesEls.length - 1); }
    });

    var touchStartX = null, touchStartY = null, touchTarget = null;
    stageOuter.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      touchStartX = t.clientX; touchStartY = t.clientY; touchTarget = e.target;
    }, { passive: true });
    stageOuter.addEventListener('touchend', function (e) {
      if (touchStartX === null || isEditingContext(touchTarget)) { touchStartX = null; return; }
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { dx < 0 ? go(idx + 1) : go(idx - 1); }
      touchStartX = null;
    }, { passive: true });
  }

  function render(listing) {
    currentListing = listing;
    stage = document.getElementById('stage');
    stageOuter = document.getElementById('stageOuter');
    btnPrev = document.getElementById('btnPrev');
    btnNext = document.getElementById('btnNext');
    deckCount = document.getElementById('deckCount');
    deckLabel = document.getElementById('deckLabel');
    deckProgress = document.getElementById('deckProgress');
    deckAnnounce = document.getElementById('deckAnnounce');

    var slides = buildSlides(listing);
    var slideRole = t('ariaSlideRole');
    stage.innerHTML = slides.map(function (s, i) {
      return '<section class="slide ' + s.cls + '" data-index="' + i + '" role="group" aria-roledescription="' + esc(slideRole) + '" aria-label="' + esc(s.label) + '" tabindex="-1">' + s.html + '</section>';
    }).join('');

    if (listing.logo || listing.companyName) {
      var logoWrap = document.createElement('div');
      logoWrap.className = 'global-logo';
      if (listing.logo) logoWrap.innerHTML += '<img src="' + listing.logo.dataUrl + '" alt="' + esc(t('logoAlt')) + '">';
      if (listing.companyName) logoWrap.innerHTML += '<span class="global-logo-name">' + esc(listing.companyName) + '</span>';
      stage.appendChild(logoWrap);
    }

    slidesEls = Array.prototype.slice.call(stage.querySelectorAll('.slide'));
    idx = 0;
    animating = false;
    showSlide(0);
    updateChrome();
    wireChromeOnce();
    fit();
    wireCalculator(stage);
  }

  /* ---------------- Landing-page thumbnails ---------------- */
  /* Reuses buildSlides() verbatim at 1/6.4 scale so the landing preview is
     pixel-identical to the real deck, not a hand-drawn approximation.
     Ids are stripped — twelve copies of #calcPrice etc. would collide. */
  function renderThumbnails(listing) {
    var container = document.getElementById('landingThumbs');
    if (!container) return;
    var slides = buildSlides(listing);
    container.innerHTML = slides.map(function (s, i) {
      var html = s.html.replace(/\sid="[^"]*"/g, '');
      /* The inner div carries the real "slide" class (not just s.cls) so it
         sizes itself via inset:0 against .thumb-stage's 1920x1080 box —
         exactly like a real slide against .stage. Giving .thumb-stage
         itself an s.cls class instead would let rules like
         .slide-split-a{height:100%} collide with — and win over, by CSS
         source order — .thumb-stage's own literal height:1080px. */
      return (
        '<div class="thumb-card">' +
          '<div class="thumb-frame"><div class="thumb-stage"><div class="slide ' + s.cls + '">' + html + '</div></div></div>' +
          '<div class="thumb-meta"><span class="thumb-num">' + pad2(i + 1) + '</span><span class="thumb-label">' + esc(s.label) + '</span></div>' +
        '</div>'
      );
    }).join('');
  }

  return { render: render, renderThumbnails: renderThumbnails };
})();
