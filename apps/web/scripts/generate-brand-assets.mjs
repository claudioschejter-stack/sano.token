#!/usr/bin/env node
/**
 * Generates Sanova brand PNGs from SVG sources:
 * - PWA / web icons (16–512)
 * - iOS App Store icon (1024×1024, opaque, square corners)
 * - Android adaptive layers (foreground + background, 512×512)
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const brandDir = path.join(publicDir, 'brand');
const iconsDir = path.join(publicDir, 'icons');
const storeDir = path.join(publicDir, 'store');

const DENSITY = 300;
const ANDROID_SAFE = 324;
const ANDROID_CANVAS = 512;

async function rasterizeSvg(svgBuffer, width, height, options = {}) {
  return sharp(svgBuffer, { density: DENSITY })
    .resize(width, height, {
      fit: 'contain',
      background: options.background ?? { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png(options.png ?? {})
    .toBuffer();
}

async function compositeIcon(size) {
  const bg = await readFile(path.join(brandDir, 'sanova-icon-background.svg'));
  const mark = await readFile(path.join(brandDir, 'sanova-isotipo.svg'));

  const background = await rasterizeSvg(bg, size, size, {
    background: { r: 6, g: 16, b: 31, alpha: 1 }
  });

  const markSize = Math.round(size * 0.58);
  const markPng = await rasterizeSvg(mark, markSize, markSize);
  const offset = Math.round((size - markSize) / 2);

  return sharp(background)
    .composite([{ input: markPng, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function androidForeground() {
  const mark = await readFile(path.join(brandDir, 'sanova-isotipo.svg'));
  const markPng = await rasterizeSvg(mark, ANDROID_SAFE, ANDROID_SAFE);
  const offset = Math.round((ANDROID_CANVAS - ANDROID_SAFE) / 2);

  return sharp({
    create: {
      width: ANDROID_CANVAS,
      height: ANDROID_CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: markPng, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function androidBackground() {
  const bg = await readFile(path.join(brandDir, 'sanova-icon-background.svg'));
  return rasterizeSvg(bg, ANDROID_CANVAS, ANDROID_CANVAS, {
    background: { r: 6, g: 16, b: 31, alpha: 1 }
  });
}

async function main() {
  await mkdir(storeDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });

  const webSizes = [
    { name: 'favicon-16.png', size: 16 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-maskable-512.png', size: 512 }
  ];

  for (const { name, size } of webSizes) {
    const buffer = await compositeIcon(size);
    await writeFile(path.join(iconsDir, name), buffer);
    console.log(`ok icons/${name}`);
  }

  const favicon32 = await readFile(path.join(iconsDir, 'favicon-32.png'));
  await writeFile(path.join(publicDir, 'favicon.ico'), favicon32);
  console.log('ok favicon.ico');

  const ios1024 = await compositeIcon(1024);
  await writeFile(path.join(storeDir, 'ios-app-icon-1024.png'), ios1024);
  console.log('ok store/ios-app-icon-1024.png');

  const fg = await androidForeground();
  const bg = await androidBackground();
  await writeFile(path.join(storeDir, 'android-adaptive-foreground-512.png'), fg);
  await writeFile(path.join(storeDir, 'android-adaptive-background-512.png'), bg);
  console.log('ok store/android-adaptive-foreground-512.png');
  console.log('ok store/android-adaptive-background-512.png');

  const play512 = await compositeIcon(512);
  await writeFile(path.join(storeDir, 'google-play-icon-512.png'), play512);
  console.log('ok store/google-play-icon-512.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
