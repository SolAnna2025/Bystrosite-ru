/* npm's postinstall hook runs after every `npm install` — including a
   plain local `npm install` during dev, not just a real deploy. Gating on
   RENDER (Render sets this automatically in its build environment) or
   NODE_ENV=production keeps local installs fast and unminified (readable
   in devtools) while still making the build step genuinely automatic on
   Render — no Build Command setting to remember or misconfigure. */
if (process.env.RENDER || process.env.NODE_ENV === 'production') {
  require('./build.js');
} else {
  console.log('Skipping minified build (not a production install) — run `npm run build` to build it manually.');
}
