#!/usr/bin/env node
/**
 * Extracts the Sanova app button/logo from a source image (white bg + optional Gemini watermark),
 * removes padding/watermark, upscales to max resolution, and writes platform + store PNGs.
 */
import { copyFile, mkdir, writeFile, unlink } from 'node:fs/promises';
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
  'Downloads',
  'Gemini_Generated_Image_b1lctmb1lctmb1lc.png'
);

const ANDROID_CANVAS = 512;
const MASTER_SIZE = 4096;
const WATERMARK_INSET = 28;

// Manifest background_color (#06101F) — the maskable icon must be composited
// on this so it matches the native OS splash/launcher background exactly.
const MANIFEST_BG = { r: 6, g: 16, b: 31, alpha: 1 };
// Per the maskable-icon safe-zone spec, content should stay within an ~80%
// centered safe zone; keeping the mark at ~68% leaves a comfortable margin
// so Android/iOS circular or squircle masks never clip the logo.
const MASKABLE_SAFE_RATIO = 0.68;
const WHITE_KEY_GAIN = 2.2;

/** Turns the master's flat white background into a real alpha channel (soft "white key" matte). */
async function keyOutWhiteBackground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const minChannel = Math.min(out[idx], out[idx + 1], out[idx + 2]);
    const alpha = Math.max(0, Math.min(255, Math.round((255 - minChannel) * WHITE_KEY_GAIN)));
    out[idx + 3] = alpha;
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

/** Builds icon-maskable-512.png: transparent logo, safely inset, on the manifest's own background. */
async function buildMaskableIcon(master) {
  const transparentMark = await keyOutWhiteBackground(master);
  const markSize = Math.round(ANDROID_CANVAS * MASKABLE_SAFE_RATIO);
  const mark = await sharp(transparentMark)
    .resize(markSize, markSize, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  const offset = Math.round((ANDROID_CANVAS - markSize) / 2);

  return sharp({
    create: { width: ANDROID_CANVAS, height: ANDROID_CANVAS, channels: 4, background: MANIFEST_BG }
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** Detect blue squircle bounds; ignore white bg and faint Gemini star. */
async function detectLogoBounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const isLogoPixel = b > 100 && r < 200 && g < 220 && r + g + b < 700;
      if (!isLogoPixel) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const side = Math.min(boxW, boxH) - WATERMARK_INSET;
  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  const left = Math.max(0, cx - Math.floor(side / 2));
  const top = Math.max(0, cy - Math.floor(side / 2));

  return { left, top, width: side, height: side };
}

async function isolateLogo(input) {
  const bounds = await detectLogoBounds(input);
  return sharp(input).extract(bounds).png().toBuffer();
}

let masterCache = null;

/** Progressive upscale to 4096 for maximum quality. */
async function buildMaster(isolated) {
  if (masterCache) return masterCache;

  const meta = await sharp(isolated).metadata();
  const base = meta.width ?? 512;

  masterCache = await sharp(isolated)
    .resize(Math.round(base * 2), Math.round(base * 2), { kernel: sharp.kernel.lanczos3 })
    .resize(Math.round(base * 4), Math.round(base * 4), { kernel: sharp.kernel.lanczos3 })
    .resize(MASTER_SIZE, MASTER_SIZE, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1.2, m1: 0.65, m2: 0.32, x1: 2, y2: 10, y3: 20 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return masterCache;
}

function upscaleFromMaster(master, size) {
  return sharp(master)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: size >= 256 ? 0.65 : 0.4, m1: 0.5, m2: 0.25, x1: 2, y2: 10, y3: 20 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  await mkdir(brandDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log('source', SOURCE, `${meta.width}x${meta.height}`);

  const isolated = await isolateLogo(SOURCE);
  const isoMeta = await sharp(isolated).metadata();
  console.log('isolated', `${isoMeta.width}x${isoMeta.height}`);

  await writeFile(path.join(brandDir, 'logo-sanova-source.png'), isolated);
  console.log('ok brand/logo-sanova-source.png');

  const master4096 = await buildMaster(isolated);
  await writeFile(path.join(brandDir, 'logo-sanova-4096.png'), master4096);
  console.log('ok brand/logo-sanova-4096.png');

  const master2048 = await upscaleFromMaster(master4096, 2048);
  await writeFile(path.join(brandDir, 'logo-sanova-2048.png'), master2048);
  console.log('ok brand/logo-sanova-2048.png');

  const master1024 = await upscaleFromMaster(master4096, 1024);
  await writeFile(path.join(brandDir, 'logo-sanova.png'), master1024);
  await writeFile(path.join(brandDir, 'logo-sanova-1024.png'), master1024);
  console.log('ok brand/logo-sanova.png');

  // Legacy aliases used by SanovaLogo + prior commits
  await copyFile(path.join(brandDir, 'logo-sanova.png'), path.join(brandDir, 'sanova-app-button-1024.png'));
  await copyFile(path.join(brandDir, 'logo-sanova-2048.png'), path.join(brandDir, 'sanova-app-button-2048.png'));
  await copyFile(path.join(brandDir, 'logo-sanova-source.png'), path.join(brandDir, 'sanova-app-button-source.png'));
  await copyFile(path.join(brandDir, 'logo-sanova.png'), path.join(brandDir, 'sanova-logo.png'));
  console.log('ok brand legacy aliases');

  const webSizes = [
    { name: 'favicon-16.png', size: 16 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-maskable-512.png', size: 512 }
  ];

  for (const { name, size } of webSizes) {
    const buffer =
      name === 'icon-maskable-512.png'
        ? await buildMaskableIcon(master4096)
        : await upscaleFromMaster(master4096, size);
    await writeFile(path.join(iconsDir, name), buffer);
    console.log(`ok icons/${name}`);
  }

  const favicon32 = await upscaleFromMaster(master4096, 32);
  await writeFile(path.join(publicDir, 'favicon.ico'), favicon32);
  console.log('ok favicon.ico');

  await writeFile(path.join(storeDir, 'ios-app-icon-1024.png'), master1024);
  console.log('ok store/ios-app-icon-1024.png');

  const play512 = await upscaleFromMaster(master4096, 512);
  await writeFile(path.join(storeDir, 'google-play-icon-512.png'), play512);
  console.log('ok store/google-play-icon-512.png');

  await writeFile(path.join(storeDir, 'android-adaptive-background-512.png'), play512);
  const transparentFg = await sharp({
    create: {
      width: ANDROID_CANVAS,
      height: ANDROID_CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .png()
    .toBuffer();
  await writeFile(path.join(storeDir, 'android-adaptive-foreground-512.png'), transparentFg);
  console.log('ok store/android-adaptive-*-512.png');

  try {
    await unlink(path.join(brandDir, '_test-crop.png'));
  } catch {
    // optional cleanup
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
