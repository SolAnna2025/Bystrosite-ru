/* ============================================================
   Быстросайт — production build.
   Minifies+mangles every project-owned .js file (terser) and minifies
   every .css file (cssnano, via PostCSS) into dist/, mirroring the source
   tree so index.html's relative paths ("css/style.css", "js/app.js", ...)
   resolve unchanged whether they're served from the repo root (dev) or
   from dist/ (production — see server.js, which prefers dist/ over the
   repo root for any path dist/ has a file for, falling back to the root
   for everything dist/ doesn't build: index.html, privacy.html, assets/,
   the CDN-hosted html2canvas/jsPDF scripts).

   Runs automatically on every `npm install` in a production environment
   (see scripts/postinstall.js — gated so a plain local install doesn't
   also minify) — Render (or any host that runs `npm install` before
   `npm start`) picks this up with zero dashboard configuration. `npm run
   build` still works too, for a manual rebuild without a full reinstall.

   "Obfuscation": terser's mangle renames every local variable/function to
   a short, meaningless name and strips all comments — real minification,
   not just whitespace removal, but not a heavyweight control-flow-
   flattening obfuscator either. Nothing here is a secret (Supabase's anon
   key already ships in cleartext by design — see js/supabase-config.js);
   the goal is "don't ship readable annotated source to production", not
   defeating a determined reverse engineer.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const postcss = require('postcss');
const cssnano = require('cssnano');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');

const JS_FILES = ['js/colorgrade.js', 'js/slots.js', 'js/i18n.js', 'js/deck.js', 'js/supabase-config.js', 'js/app.js'];
const CSS_FILES = ['css/style.css', 'css/deck.css'];

async function buildJs(relPath) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  const result = await minify(src, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (result.error) throw result.error;
  return result.code;
}

async function buildCss(relPath) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  const result = await postcss([cssnano({ preset: 'default' })]).process(src, {
    from: path.join(root, relPath),
    map: false,
  });
  return result.css;
}

async function main() {
  fs.rmSync(distDir, { recursive: true, force: true });

  let beforeTotal = 0, afterTotal = 0;
  for (const relPath of JS_FILES) {
    const before = fs.statSync(path.join(root, relPath)).size;
    const code = await buildJs(relPath);
    const outPath = path.join(distDir, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, code);
    beforeTotal += before; afterTotal += code.length;
    console.log(relPath, '->', (before / 1024).toFixed(1) + 'KB -> ' + (code.length / 1024).toFixed(1) + 'KB');
  }
  for (const relPath of CSS_FILES) {
    const before = fs.statSync(path.join(root, relPath)).size;
    const code = await buildCss(relPath);
    const outPath = path.join(distDir, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, code);
    beforeTotal += before; afterTotal += code.length;
    console.log(relPath, '->', (before / 1024).toFixed(1) + 'KB -> ' + (code.length / 1024).toFixed(1) + 'KB');
  }
  console.log('---');
  console.log('total: ' + (beforeTotal / 1024).toFixed(1) + 'KB -> ' + (afterTotal / 1024).toFixed(1) + 'KB');
  console.log('dist/ ready — server.js will serve it automatically when present.');
}

main().catch((e) => { console.error(e); process.exit(1); });
