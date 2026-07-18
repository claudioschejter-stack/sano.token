/**
 * Regenerate public/brand/sanova-splash-bg.png with a large centered badge.
 * Run: node scripts/generate-splash-bg.js
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const BRAND = path.join(__dirname, '..', 'public', 'brand');
const LOGO = path.join(BRAND, 'sanova-app-button-source.png');
const OUT = path.join(BRAND, 'sanova-splash-bg.png');
const TMP = path.join(BRAND, 'sanova-splash-bg.tmp.png');

const W = 1170;
const H = 2532;
const NAVY = { r: 14, g: 41, b: 88 };
/** Fraction of splash width occupied by the circular badge. */
const LOGO_WIDTH_RATIO = 0.92;

async function main() {
  const logoSize = Math.round(W * LOGO_WIDTH_RATIO);
  const left = Math.round((W - logoSize) / 2);
  const top = Math.round((H - logoSize) / 2);
  const r = logoSize / 2;

  const mask = Buffer.from(
    `<svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`
  );

  const logo = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'cover' })
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: NAVY
    }
  })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(TMP);

  try {
    fs.unlinkSync(OUT);
  } catch {
    /* ignore */
  }
  fs.renameSync(TMP, OUT);

  console.log(`Wrote ${OUT} (${W}x${H}, logo ${logoSize}px @ ${left},${top})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
