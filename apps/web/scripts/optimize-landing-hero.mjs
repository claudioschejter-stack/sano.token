#!/usr/bin/env node
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] ?? path.resolve(
  process.env.USERPROFILE ?? '',
  '.cursor/projects/c-Users-Claudio-Desktop-SANOVA-GLOBAL-WEBSITE-SANOVA-RWA/assets/landing-hero-energy-yields.png'
);
const outDir = path.resolve(__dirname, '../public/images');

const meta = await sharp(src).metadata();
console.log('source', meta.width, meta.height);

const pngOut = path.join(outDir, 'landing-hero-energy-yields.png');
const webpOut = path.join(outDir, 'landing-hero-energy-yields.webp');

const pipeline = sharp(src).resize(1400, null, { withoutEnlargement: true, fit: 'inside' });

await pipeline.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(pngOut);
await pipeline.clone().webp({ quality: 88 }).toFile(webpOut);

console.log('png', statSync(pngOut).size, 'webp', statSync(webpOut).size);
