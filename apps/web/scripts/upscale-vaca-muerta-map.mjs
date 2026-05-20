import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, '../public/maps/vaca-muerta-cuenca.png');
const output = input;

/** 5× source (250×200 → 1250×1000) — sharp enough for retina in macro section. */
const SCALE = 5;

const meta = await sharp(input).metadata();
const width = Math.round(meta.width * SCALE);
const height = Math.round(meta.height * SCALE);

await sharp(input)
  .resize(width, height, {
    kernel: sharp.kernel.lanczos3,
    fit: 'fill'
  })
  .sharpen({ sigma: 0.6, m1: 0.5, m2: 2, x1: 2, y2: 10, y3: 20 })
  .png({ compressionLevel: 6, adaptiveFiltering: true })
  .toFile(output + '.tmp');

await import('fs').then(({ renameSync }) => {
  renameSync(output + '.tmp', output);
});

console.log(`Upscaled ${meta.width}×${meta.height} → ${width}×${height} (${output})`);
