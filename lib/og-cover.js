/* Link-preview image for /p/<id> (og:image) — the presentation's own cover
   slide (js/deck.js slideCover, css/deck.css .slide-cover) redrawn as a
   1200×630 JPEG: cover photo, bottom scrim, "ЧАСТНАЯ РЕЗИДЕНЦИЯ · ГОРОД"
   kicker, the title in Cormorant Garamond and the short rule under it.
   Messengers used to get the raw cover photo instead — 400 KB+, over
   WhatsApp's ~300 KB og:image limit, and with nothing on it saying what
   it was. Fonts are bundled in /fonts (SIL OFL) so the server renders the
   same type whatever the host has installed. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const W = 1200;
const H = 630;
const PAD_X = 72;
const PAD_BOTTOM = 70;
const TEXT = '#f2efe8';
// Pango on Windows can't open a font file whose path has non-ASCII
// characters (e.g. a Cyrillic user folder) and silently falls back to
// another typeface — copy the fonts somewhere ASCII-only first.
function fontPath(name) {
  const src = path.join(__dirname, '..', 'fonts', name);
  if (/^[\x20-\x7e]*$/.test(src)) return src;
  const dst = path.join(os.tmpdir(), 'bystrosite-fonts', name);
  try {
    if (!fs.existsSync(dst)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
    return dst;
  } catch (e) { return src; }
}
const HEADING_FONT = fontPath('CormorantGaramond-Medium.ttf');
const BODY_FONT = fontPath('Manrope-SemiBold.ttf');

const KICKER = { ru: 'Частная резиденция', en: 'Private residence' };

function escapeMarkup(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Same rule as js/deck.js cityOf().
function cityOf(locationName) {
  return locationName ? String(locationName).split(',')[0].trim() : '';
}

function renderText(markup, fontfile, font, width) {
  return sharp({ text: { text: markup, font, fontfile, width, rgba: true, wrap: 'word' } })
    .png()
    .toBuffer({ resolveWithObject: true });
}

// The largest title size (down to 52px) that fits in two lines.
async function renderTitle(title) {
  const markup = '<span foreground="' + TEXT + '">' + escapeMarkup(title) + '</span>';
  let r;
  for (const size of [88, 76, 66, 58, 52]) {
    r = await renderText(markup, HEADING_FONT, 'Cormorant Garamond Medium, ' + size + 'px', W - PAD_X * 2);
    if (r.info.height <= size * 2.6) return r;
  }
  return r;
}

async function background(photo) {
  if (!photo) return sharp({ create: { width: W, height: H, channels: 3, background: '#2b2924' } }).png().toBuffer();
  return sharp(photo).rotate().resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
}

// The deck's .ph-scrim-bottom, a little stronger: a preview is small and
// the title has to stay readable at thumbnail size.
const SCRIM = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
  '<defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">' +
  '<stop offset="0" stop-color="#0f0e0b" stop-opacity="0.82"/>' +
  '<stop offset="0.5" stop-color="#0f0e0b" stop-opacity="0.45"/>' +
  '<stop offset="0.85" stop-color="#0f0e0b" stop-opacity="0"/>' +
  '</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>'
);

/* listing: { title, locationName, language }, photo: Buffer | null.
   Resolves to a JPEG buffer. */
async function renderOgCover(listing, photo) {
  const lang = listing.language === 'en' ? 'en' : 'ru';
  const city = cityOf(listing.locationName);
  const kickerText = (KICKER[lang] + (city ? ' · ' + city : '')).toUpperCase();
  const kicker = await renderText(
    '<span foreground="' + TEXT + '" alpha="78%" letter_spacing="' + Math.round(19 * 0.16 * 1024) + '">' + escapeMarkup(kickerText) + '</span>',
    BODY_FONT, 'Manrope, Semi-Bold 19px', W - PAD_X * 2
  );
  const title = await renderTitle(listing.title || (lang === 'en' ? 'Property presentation' : 'Презентация объекта'));

  const rule = { input: { create: { width: 72, height: 2, channels: 4, background: { r: 242, g: 239, b: 232, alpha: 0.75 } } } };
  const ruleTop = H - PAD_BOTTOM - 2;
  const titleTop = ruleTop - 26 - title.info.height;
  const kickerTop = titleTop - 22 - kicker.info.height;

  let base;
  try { base = await background(photo); } catch (e) { base = await background(null); }

  const out = sharp(base).composite([
    { input: SCRIM, top: 0, left: 0 },
    { input: kicker.data, top: Math.max(0, kickerTop), left: PAD_X },
    { input: title.data, top: Math.max(0, titleTop), left: PAD_X - 2 },
    Object.assign(rule, { top: ruleTop, left: PAD_X }),
  ]);
  // WhatsApp skips og:images over ~300 KB.
  let jpeg = await out.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  if (jpeg.length > 280000) jpeg = await out.clone().jpeg({ quality: 68, mozjpeg: true }).toBuffer();
  return jpeg;
}

module.exports = { renderOgCover, OG_WIDTH: W, OG_HEIGHT: H };
