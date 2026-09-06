/* ============================================================
   Быстросайт — canonical photo-slot list.
   Single source of truth for both the /new-listing uploader
   (js/app.js) and the deck renderer (js/deck.js), so a slot's
   key/label and its place in the presentation never drift apart.
   Bedroom/bathroom slots are generated from the listing's own
   counts, so the list always matches the actual property.
   Labels come from js/i18n.js at call time, so they always reflect
   the current language — nothing here is cached across a switch.
   ============================================================ */

window.BSSlots = (function () {
  'use strict';

  function get(bedrooms, bathrooms, hasPool, hasYard) {
    var t = window.BSI18n ? window.BSI18n.t : function (k) { return k; };
    var n = Math.max(0, Math.floor(Number(bedrooms) || 0));
    var m = Math.max(0, Math.floor(Number(bathrooms) || 0));

    var slots = [
      { key: 'cover', label: t('slotCover') },
      { key: 'emotion', label: t('slotEmotion') },
      { key: 'facade1', label: t('slotFacade1') },
      { key: 'facade2', label: t('slotFacade2') },
      { key: 'facade3', label: t('slotFacade3') },
      { key: 'facade4', label: t('slotFacade4') },
      { key: 'living', label: t('slotLiving') },
    ];
    if (hasPool) slots.push({ key: 'pool', label: t('slotPool') });
    if (hasYard) slots.push({ key: 'terrace', label: t('slotTerrace') }, { key: 'terrace2', label: t('slotTerrace2') });
    slots.push(
      { key: 'detail1', label: t('slotDetail1') },
      { key: 'detail2', label: t('slotDetail2') },
      { key: 'detail3', label: t('slotDetail3') }
    );

    /* Interiors: a fixed 4-slot block (hall/kitchen/dining/extra),
       independent of the bedroom/bathroom counts below — all four are
       optional, and the "Интерьеры" slide only shows whichever ones
       actually got a photo (see js/deck.js slideInteriors). */
    slots.push(
      { key: 'interiorHall', label: t('slotInteriorHall') },
      { key: 'interiorKitchen', label: t('slotInteriorKitchen') },
      { key: 'interiorDining', label: t('slotInteriorDining') },
      { key: 'interiorExtra', label: t('slotInteriorExtra') }
    );

    for (var i = 1; i <= n; i++) {
      slots.push({ key: 'bedroom' + i, label: t('slotBedroom') + ' ' + i + (n > 1 ? ' ' + t('slotOutOf') + ' ' + n : ''), group: 'bedroom' });
    }
    for (var j = 1; j <= m; j++) {
      slots.push({ key: 'bathroom' + j, label: t('slotBathroom') + ' ' + j + (m > 1 ? ' ' + t('slotOutOf') + ' ' + m : ''), group: 'bathroom' });
    }

    slots.push({ key: 'final', label: t('slotFinal') });
    return slots;
  }

  return { get: get };
})();
