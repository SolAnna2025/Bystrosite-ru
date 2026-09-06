/* ============================================================
   Быстросайт — artifact build script.
   Rebuilds the bundled single-file HTML (used for the published
   Artifact) fresh from the current source files each time, and
   embeds the stock demo photos as base64 data URIs — so image
   bytes never have to pass through an LLM tool call.
   Usage: node scripts/build-artifact.js <path-to-output-html>
   ============================================================ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: node scripts/build-artifact.js <path-to-output-html>');
  process.exit(1);
}

function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }

const styleCss = read('css/style.css');
const deckCss = read('css/deck.css');
const slotsJs = read('js/slots.js');
let appJs = read('js/app.js');
const deckJs = read('js/deck.js');
const indexHtml = read('index.html');

/* ---------------- Extract the body markup between markers ---------------- */

const startMarker = '<!-- ARTIFACT:BODY:START -->';
const endMarker = '<!-- ARTIFACT:BODY:END -->';
const startIdx = indexHtml.indexOf(startMarker);
const endIdx = indexHtml.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('BODY markers not found in index.html');
  process.exit(1);
}
const bodyHtml = indexHtml.slice(startIdx + startMarker.length, endIdx).trim();

/* ---------------- Embed stock photos as base64 ---------------- */

const stockDir = path.join(root, 'assets', 'stock');
const stockKeys = ['cover', 'emotion', 'facade1', 'facade2', 'living', 'pool', 'terrace',
  'detail1', 'detail2', 'detail3', 'bedroom1', 'bedroom2', 'bedroom3', 'bedroom4',
  'bathroom1', 'bathroom2', 'bathroom3', 'final'];

const stockData = {};
let totalBytes = 0;
stockKeys.forEach(function (key) {
  const buf = fs.readFileSync(path.join(stockDir, key + '.jpg'));
  totalBytes += buf.length;
  stockData[key] = 'data:image/jpeg;base64,' + buf.toString('base64');
});
console.log('embedded ' + stockKeys.length + ' photos, ' + (totalBytes / 1024 / 1024).toFixed(2) + ' MB raw');

// The artifact seeds every slot with a stock photo by default (same as the
// local demo) — swap the relative-path seeding in app.js for a lookup into
// the embedded base64 map.
const oldSeed = "BS.photosBySlot[key] = { name: key + '.jpg', dataUrl: 'assets/stock/' + key + '.jpg' };";
const newSeed = "BS.photosBySlot[key] = { name: key + '.jpg', dataUrl: window.BS_STOCK_DATA[key] };";
if (appJs.indexOf(oldSeed) === -1) {
  console.error('PATCH FAILED — stock-seed anchor not found in js/app.js');
  process.exit(1);
}
appJs = appJs.replace(oldSeed, newSeed);

const stockDataScript = 'window.BS_STOCK_DATA = ' + JSON.stringify(stockData) + ';';

/* ---------------- Assemble ---------------- */

const html = [
  '<title>Быстросайт</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">',
  '<style>',
  styleCss,
  deckCss,
  '</style>',
  '',
  bodyHtml,
  '',
  '<script>' + stockDataScript + '</script>',
  '<script>' + slotsJs + '</script>',
  '<script>' + appJs + '</script>',
  '<script>' + deckJs + '</script>',
].join('\n');

fs.writeFileSync(outPath, html, 'utf8');
console.log('done -> ' + outPath + ' (' + (html.length / 1024 / 1024).toFixed(2) + ' MB)');
