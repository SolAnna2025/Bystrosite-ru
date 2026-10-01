/* Automatic RU/EN versions of a listing's own texts (title, description,
   phrases, ...), so one presentation opens in both languages instead of
   the agent building a second one by hand. Machine translation via Yandex
   Translate (Yandex Cloud) — configured by env vars, off without them:

     YANDEX_TRANSLATE_API_KEY   API key of a service account with the
                                ai.translate.user role
     YANDEX_FOLDER_ID           folder id (optional for a service-account key)

   Every text goes to *both* languages with the source language detected
   per text, since agents don't always type in the language they picked
   (an English description in a Russian-language presentation is common).
   Only fields whose source text changed since the last save are sent
   again (see `src`), so re-saving an unchanged listing costs nothing. */

const API_KEY = process.env.YANDEX_TRANSLATE_API_KEY || '';
const FOLDER_ID = process.env.YANDEX_FOLDER_ID || '';
const LANGS = ['ru', 'en'];

// Free-text fields only — selects, numbers and proper names (company,
// management company) stay as typed.
const FIELDS = [
  'title', 'description', 'emotionPhrase', 'closingPhrase', 'locationName',
  'poolSize', 'yard', 'extraFeatures', 'communityInfo', 'buildingInfo',
  'complexName', 'elevators', 'parking', 'infrastructure', 'nearby',
  'rentMarketRange',
];

function configured() { return !!API_KEY; }

async function yandexTranslate(texts, target) {
  const body = { texts, targetLanguageCode: target, format: 'PLAIN_TEXT' };
  if (FOLDER_ID) body.folderId = FOLDER_ID;
  const res = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Api-Key ' + API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('Yandex Translate ' + res.status + ' ' + (await res.text()).slice(0, 300));
  const data = await res.json();
  return (data.translations || []).map((t) => t.text);
}

/* listing: the saved listing (camelCase, as the form sends it).
   previous: the last stored result or null.
   Resolves to { src: {field: text}, ru: {field: text}, en: {field: text} }. */
async function buildTranslations(listing, previous) {
  const prev = previous && previous.src ? previous : { src: {}, ru: {}, en: {} };
  const out = { src: {}, ru: {}, en: {} };
  const todo = [];
  for (const f of FIELDS) {
    const text = typeof listing[f] === 'string' ? listing[f].trim() : '';
    if (!text) continue;
    out.src[f] = text;
    if (prev.src[f] === text && LANGS.every((l) => typeof (prev[l] || {})[f] === 'string')) {
      LANGS.forEach((l) => { out[l][f] = prev[l][f]; });
    } else {
      todo.push(f);
    }
  }
  if (todo.length) {
    const texts = todo.map((f) => out.src[f]);
    for (const lang of LANGS) {
      const translated = await yandexTranslate(texts, lang);
      todo.forEach((f, i) => { out[lang][f] = translated[i] || out.src[f]; });
    }
  }
  return out;
}

module.exports = { configured, buildTranslations, FIELDS };
