import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/logos/operators');
const UA = 'Mozilla/5.0';

const html = await fetch('https://www.gypnqn.com.ar/', { headers: { 'User-Agent': UA } }).then((r) =>
  r.text()
);

const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
console.log('imgs', imgs.slice(0, 15));

const logo = imgs.find((src) => /logo|gyp|header|brand/i.test(src)) ?? imgs[0];
const url = logo.startsWith('http') ? logo : `https://www.gypnqn.com.ar${logo.startsWith('/') ? logo : `/${logo}`}`;
console.log('using', url);

const response = await fetch(url, { headers: { 'User-Agent': UA } });
const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync(path.join(outDir, 'gyp.png'), buffer);
console.log('saved', buffer.length);
