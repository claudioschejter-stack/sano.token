#!/usr/bin/env node
/**
 * Extracts the Sanova square (squircle) platform logo from a source image
 * (white bg + optional Gemini watermark), upscales, and writes brand PNGs.
 *
 * Round home-screen icons: `npm run pwa:icons` → generate-home-icons.mjs
 */
import { copyFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const brandDir = path.join(publicDir, 'brand');

const SOURCE = process.argv[2] ?? path.join(
  process.env.USERPROFILE ?? '',
  'Downloads',
  'Gemini_Generated_Image_b1lctmb1lctmb1lc.png'
);

const MASTER_SIZE = 4096;
const WATERMARK_INSET = 28;

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

  await copyFile(path.join(brandDir, 'logo-sanova.png'), path.join(brandDir, 'sanova-logo.png'));
  console.log('ok brand/sanova-logo.png (square). Run npm run pwa:icons for round home icons.');

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
