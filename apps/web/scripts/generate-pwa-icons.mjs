import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../public/icons');
const svgPath = path.join(iconsDir, 'icon.svg');

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 }
];

const svg = await readFile(svgPath);

for (const { name, size } of sizes) {
  const output = path.join(iconsDir, name);
  await sharp(svg, { density: 300 })
    .resize(size, size, { fit: 'contain', background: '#2563eb' })
    .png()
    .toFile(output);
  console.log(`ok ${name}`);
}

const favicon32 = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer();
const faviconPath = path.resolve(__dirname, '../public/favicon.ico');
await writeFile(faviconPath, favicon32);
console.log('ok favicon.ico (32px PNG payload)');
