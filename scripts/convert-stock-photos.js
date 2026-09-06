/* One-off: re-encode assets/stock/*.png (uncompressed PNG exports, ~2-3MB
   each, 54MB total) as JPEG quality 82 — matching the same maxDim/quality
   the live upload pipeline already applies to every agent-supplied photo
   (see resizeImage() in js/app.js). These stock photos back the free demo
   listing shown to every visitor, so their weight was the single biggest
   thing standing between "page load" and "photos visible" — and multiplied
   again during PDF export, which decodes every one of them into a canvas.
   Run once locally: node scripts/convert-stock-photos.js */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, '..', 'assets', 'stock');
const MAX_DIM = 1600;
const QUALITY = 82;

async function main() {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
  let beforeTotal = 0, afterTotal = 0;
  for (const file of files) {
    const srcPath = path.join(dir, file);
    const destPath = path.join(dir, file.replace(/\.png$/i, '.jpg'));
    const before = fs.statSync(srcPath).size;
    const img = sharp(srcPath);
    const meta = await img.metadata();
    if (meta.width > MAX_DIM || meta.height > MAX_DIM) {
      img.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });
    }
    await img.flatten({ background: '#ffffff' }).jpeg({ quality: QUALITY, mozjpeg: true }).toFile(destPath);
    const after = fs.statSync(destPath).size;
    beforeTotal += before; afterTotal += after;
    fs.unlinkSync(srcPath);
    console.log(file, '->', path.basename(destPath), (before / 1024).toFixed(0) + 'KB -> ' + (after / 1024).toFixed(0) + 'KB');
  }
  console.log('---');
  console.log('total:', (beforeTotal / 1024 / 1024).toFixed(1) + 'MB -> ' + (afterTotal / 1024 / 1024).toFixed(1) + 'MB');
}

main().catch((e) => { console.error(e); process.exit(1); });
