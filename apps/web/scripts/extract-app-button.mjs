#!/usr/bin/env node
/**
 * Isolates and upscales the Sanova app button from the source JPG
 * into logo + PWA + store PNG assets (raster-only, no SVG composite).
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

const SOURCE = process.argv[2] ?? path.join(
  process.env.USERPROFILE ?? '',
  'Pictures',
  'Sanova Global — Tokenized Real Estate_files',
  'logo sanova.jpg'
);

const ANDROID_SAFE = 324;
const ANDROID_CANVAS = 512;

/** Square-crop center region (source is already the app button). */
async function isolateButton(input) {
  const meta = await sharp(input).metadata();
  const side = Math.min(meta.width ?? 0, meta.height ?? 0);
  const left = Math.round(((meta.width ?? side) - side) / 2);
  const top = Math.round(((meta.height ?? side) - side) / 2);

  return sharp(input)
    .extract({ left, top, width: side, height: side })
    .png()
    .toBuffer();
}

let masterCache = null;

/** Progressive upscale to 2048, then downsample for crisp edges. */
async function buildMaster(isolated) {
  if (masterCache) return masterCache;
  masterCache = await sharp(isolated)
    .resize(646, 646, { kernel: sharp.kernel.lanczos3 })
    .resize(2048, 2048, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1.1, m1: 0.6, m2: 0.3, x1: 2, y2: 10, y3: 20 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  return masterCache;
}

function upscaleFromMaster(master, size) {
  return sharp(master)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: size >= 256 ? 0.6 : 0.35, m1: 0.5, m2: 0.25, x1: 2, y2: 10, y3: 20 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  await mkdir(brandDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log('source', SOURCE, `${meta.width}x${meta.height}`);

  const isolated = await isolateButton(SOURCE);
  await writeFile(path.join(brandDir, 'sanova-app-button-source.png'), isolated);
  console.log('ok brand/sanova-app-button-source.png');

  const master2048 = await buildMaster(isolated);
  await writeFile(path.join(brandDir, 'sanova-app-button-2048.png'), master2048);
  console.log('ok brand/sanova-app-button-2048.png');

  const master1024 = await upscaleFromMaster(master2048, 1024);
  await writeFile(path.join(brandDir, 'sanova-app-button-1024.png'), master1024);
  console.log('ok brand/sanova-app-button-1024.png');

  await copyFile(
    path.join(brandDir, 'sanova-app-button-1024.png'),
    path.join(brandDir, 'sanova-logo.png')
  );
  console.log('ok brand/sanova-logo.png');

  const webSizes = [
    { name: 'favicon-16.png', size: 16 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-maskable-512.png', size: 512 }
  ];

  for (const { name, size } of webSizes) {
    const buffer = await upscaleFromMaster(master2048, size);
    await writeFile(path.join(iconsDir, name), buffer);
    console.log(`ok icons/${name}`);
  }

  const favicon32 = await upscaleFromMaster(master2048, 32);
  await writeFile(path.join(publicDir, 'favicon.ico'), favicon32);
  console.log('ok favicon.ico');

  await writeFile(path.join(storeDir, 'ios-app-icon-1024.png'), master1024);
  console.log('ok store/ios-app-icon-1024.png');

  const play512 = await upscaleFromMaster(master2048, 512);
  await writeFile(path.join(storeDir, 'google-play-icon-512.png'), play512);
  console.log('ok store/google-play-icon-512.png');

  // Adaptive Android: full button as opaque layers (no separate foreground mark)
  await writeFile(path.join(storeDir, 'android-adaptive-background-512.png'), play512);
  const transparentFg = await sharp({
    create: {
      width: ANDROID_CANVAS,
      height: ANDROID_CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();
  await writeFile(path.join(storeDir, 'android-adaptive-foreground-512.png'), transparentFg);
  console.log('ok store/android-adaptive-*-512.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
