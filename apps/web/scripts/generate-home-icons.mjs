#!/usr/bin/env node
/**
 * Builds PWA / home-screen icons from the round Sanova badge on manifest navy (#0B2240).
 * Keeps the square (squircle) platform logo untouched — round assets are home + logout only.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const brandDir = path.join(publicDir, 'brand');
const iconsDir = path.join(publicDir, 'icons');
const storeDir = path.join(publicDir, 'store');

/** Same as apps/web/public/manifest.json background_color */
const MANIFEST_BG = { r: 11, g: 34, b: 64, alpha: 1 };
const ANDROID_CANVAS = 512;
/** Round badge fills most of the launcher tile; OS squircle mask keeps navy in the corners. */
const ANY_FILL_RATIO = 0.94;
/** Maskable safe zone (~80% spec); 0.72 leaves margin under Android adaptive masks. */
const MASKABLE_SAFE_RATIO = 0.72;

/** Prefer the square platform badge as source; we circular-mask it for home icons only. */
const ROUND_SOURCE =
  process.argv[2] ?? path.join(brandDir, 'logo-sanova-1024.png');

async function circularMask(size) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>
    </svg>`
  );
  return sharp(svg).png().toBuffer();
}

/** Square badge → circular PNG with transparent outside. */
async function toCircularBadge(input, size) {
  const resized = await sharp(input)
    .resize(size, size, { kernel: sharp.kernel.lanczos3, fit: 'cover' })
    .ensureAlpha()
    .png()
    .toBuffer();
  const mask = await circularMask(size);
  return sharp(resized)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function composeOnNavy(circularBadge, canvasSize, fillRatio) {
  const markSize = Math.round(canvasSize * fillRatio);
  const mark = await sharp(circularBadge)
    .resize(markSize, markSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const offset = Math.round((canvasSize - markSize) / 2);
  return sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: MANIFEST_BG }
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });
  await mkdir(brandDir, { recursive: true });

  const meta = await sharp(ROUND_SOURCE).metadata();
  console.log('round source', ROUND_SOURCE, `${meta.width}x${meta.height}`);

  const masterCircle = await toCircularBadge(ROUND_SOURCE, 1024);
  await writeFile(path.join(brandDir, 'sanova-app-button-1024.png'), masterCircle);
  console.log('ok brand/sanova-app-button-1024.png (circular)');

  const circle2048 = await toCircularBadge(ROUND_SOURCE, 2048);
  await writeFile(path.join(brandDir, 'sanova-app-button-2048.png'), circle2048);
  console.log('ok brand/sanova-app-button-2048.png (circular)');

  const sizes = [
    { name: 'favicon-16.png', size: 16, fill: ANY_FILL_RATIO },
    { name: 'favicon-32.png', size: 32, fill: ANY_FILL_RATIO },
    { name: 'apple-touch-icon.png', size: 180, fill: ANY_FILL_RATIO },
    { name: 'icon-192.png', size: 192, fill: ANY_FILL_RATIO },
    { name: 'icon-512.png', size: 512, fill: ANY_FILL_RATIO },
    { name: 'icon-maskable-512.png', size: 512, fill: MASKABLE_SAFE_RATIO }
  ];

  for (const { name, size, fill } of sizes) {
    const circle = await toCircularBadge(ROUND_SOURCE, size);
    const buffer = await composeOnNavy(circle, size, fill);
    await writeFile(path.join(iconsDir, name), buffer);
    console.log(`ok icons/${name}`);
  }

  const favicon32 = await composeOnNavy(await toCircularBadge(ROUND_SOURCE, 32), 32, ANY_FILL_RATIO);
  await writeFile(path.join(publicDir, 'favicon.ico'), favicon32);
  console.log('ok favicon.ico');

  const store1024 = await composeOnNavy(masterCircle, 1024, ANY_FILL_RATIO);
  await writeFile(path.join(storeDir, 'ios-app-icon-1024.png'), store1024);
  const play512 = await composeOnNavy(await toCircularBadge(ROUND_SOURCE, 512), 512, ANY_FILL_RATIO);
  await writeFile(path.join(storeDir, 'google-play-icon-512.png'), play512);
  await writeFile(path.join(storeDir, 'android-adaptive-background-512.png'), play512);
  console.log('ok store icons');

  // Do not touch logo-sanova*.png — square platform mark stays separate.
  try {
    await copyFile(path.join(brandDir, 'logo-sanova.png'), path.join(brandDir, 'sanova-logo.png'));
  } catch {
    // optional alias
  }

  console.log('done — square logo-sanova* left unchanged');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
