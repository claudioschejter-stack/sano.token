/**
 * One-off script: regenerate the PWA/home-screen icons (manifest icons,
 * apple-touch-icon, favicons) from the new round Sanova badge artwork.
 * Run with: node scripts/generate-pwa-icons.js
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error('Usage: node generate-pwa-icons.js <source-image-path>');
  process.exit(1);
}

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function buildIco(pngBuffers) {
  // Minimal ICO container embedding raw PNG data per entry ("PNG-in-ICO"),
  // supported by all modern browsers and Windows since Vista.
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buffer)]);
}

async function main() {
  const square = () => sharp(SOURCE).resize(1024, 1024, { fit: 'cover' });

  await square().resize(512, 512).toFile(path.join(ICONS_DIR, 'icon-512.png'));
  await square().resize(192, 192).toFile(path.join(ICONS_DIR, 'icon-192.png'));
  await square().resize(180, 180).toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));

  // The source art already has ~10% breathing room around the badge, which
  // doubles as the maskable safe zone — reuse the same crop instead of
  // compositing extra padding (that introduced a visible seam against the
  // artwork's own background gradient).
  await square().resize(512, 512).toFile(path.join(ICONS_DIR, 'icon-maskable-512.png'));

  await square().resize(32, 32).toFile(path.join(ICONS_DIR, 'favicon-32.png'));
  await square().resize(16, 16).toFile(path.join(ICONS_DIR, 'favicon-16.png'));

  const ico16 = await square().resize(16, 16).png().toBuffer();
  const ico32 = await square().resize(32, 32).png().toBuffer();
  const ico48 = await square().resize(48, 48).png().toBuffer();
  const ico = await buildIco([
    { size: 16, buffer: ico16 },
    { size: 32, buffer: ico32 },
    { size: 48, buffer: ico48 }
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), ico);

  console.log('Done. Regenerated icons in', ICONS_DIR, 'and public/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
