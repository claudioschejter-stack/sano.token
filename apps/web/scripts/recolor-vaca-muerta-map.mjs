import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, '../public/maps/Mapa de la Cuenca de Vaca Muerta.jfif');
const output = path.join(__dirname, '../public/maps/vaca-muerta-cuenca.png');

/** Institutional palette (macro section). */
const SEA = { r: 30, g: 58, b: 95 }; // ocean blue (readable as "mar")
const BASIN = { r: 56, g: 189, b: 248 }; // sky-400 / celeste

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/** Bright orange fill of the basin + callout only. */
function isOrangeBasin(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  return (
    s > 0.52 &&
    h >= 22 &&
    h <= 48 &&
    l >= 0.42 &&
    l <= 0.78 &&
    r >= 175 &&
    g >= 70 &&
    r > g * 1.15
  );
}

/** Dark brown background (ocean) — e.g. rgb(40,23,7). Keeps beige land and neutral black ink. */
function isBrownSea(r, g, b) {
  if (isOrangeBasin(r, g, b)) return false;
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l > 0.72 && s < 0.22) return false; // beige land
  const neutralInk = Math.max(r, g, b) - Math.min(r, g, b) < 18 && l < 0.14;
  if (neutralInk) return false;
  return (
    r >= 32 &&
    r > g &&
    g >= b &&
    r - b >= 10 &&
    h >= 5 &&
    h <= 55 &&
    l <= 0.42
  );
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (isOrangeBasin(r, g, b)) {
    data[i] = BASIN.r;
    data[i + 1] = BASIN.g;
    data[i + 2] = BASIN.b;
  } else if (isBrownSea(r, g, b)) {
    data[i] = SEA.r;
    data[i + 1] = SEA.g;
    data[i + 2] = SEA.b;
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log(`Wrote ${output} (${info.width}x${info.height})`);
