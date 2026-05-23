import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/logos/operators/pae.png');
const UA = 'Mozilla/5.0';

const urls = [
  'https://www.pan-energy.com/Style%20Library/PAE/images/logo-pan-american-energy-pae.png',
  'https://www.pan-energy.com/_layouts/15/images/siteIcon.png'
];

for (const url of urls) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 500) continue;
    fs.writeFileSync(out, buffer);
    console.log('OK', url, buffer.length);
    process.exit(0);
  } catch (error) {
    console.warn('FAIL', url, error.message);
  }
}

const html = await fetch('https://www.pan-energy.com/', { headers: { 'User-Agent': UA } }).then((r) => r.text());
const match = html.match(/logo-pan-american-energy[^"']+\.(?:png|svg)/i);
console.log('found in html:', match);
