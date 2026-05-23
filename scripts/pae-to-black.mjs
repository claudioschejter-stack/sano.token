import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const input = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../apps/web/public/logos/operators/pae.png'
);
const output = input;

const { PNG } = await import('pngjs');
const source = PNG.sync.read(fs.readFileSync(input));
const { width, height, data } = source;
const out = new PNG({ width, height });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const isForeground = luminance > 40;
  out.data[i] = isForeground ? 15 : 0;
  out.data[i + 1] = isForeground ? 23 : 0;
  out.data[i + 2] = isForeground ? 42 : 0;
  out.data[i + 3] = isForeground ? 255 : 0;
}

fs.writeFileSync(output, PNG.sync.write(out));
console.log('PAE -> black on transparent', width, 'x', height);
