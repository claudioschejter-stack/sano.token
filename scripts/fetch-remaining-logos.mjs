import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/logos/operators');
const UA = 'Mozilla/5.0';

const DIRECT = {
  pae: 'https://www.pan-energy.com/Style%20Library/PAE/images/logo-pan-american-energy-pae.png',
  cgc: 'https://cgc.energy/esp/wp-content/uploads/2019/01/cgclogo.png',
  tecpetrol: 'https://www.tecpetrol.com/wp-content/uploads/2019/05/logo-tecpetrol.svg',
  vista: 'https://vistaenergy.com/images/logo-vista.svg',
  madalena: 'https://www.madalenaenergy.com/wp-content/themes/madalena/assets/images/logo.svg',
  gyp: 'https://www.gyp.com.ar/images/logo-gyp.png',
  pluspetrol: 'https://www.pluspetrol.net/wp-content/uploads/2020/06/logo-pluspetrol.png'
};

async function download(id, url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 500) throw new Error('too small');
  const type = response.headers.get('content-type') ?? url;
  const ext = type.includes('svg') || url.endsWith('.svg') ? 'svg' : 'png';
  fs.writeFileSync(path.join(outDir, `${id}.${ext}`), buffer);
  console.log(`OK ${id}.${ext} (${buffer.length} bytes)`);
  return ext;
}

async function scrapeTecpetrol() {
  const html = await fetch('https://www.tecpetrol.com/', { headers: { 'User-Agent': UA } }).then((r) =>
    r.text()
  );
  const match = html.match(/https?:\/\/[^"'\\s]+logo[^"'\\s]*\.(?:png|svg|webp)/i);
  if (match) return download('tecpetrol', match[0]);
  throw new Error('not found');
}

async function scrapeVista() {
  const html = await fetch('https://vistaenergy.com/', { headers: { 'User-Agent': UA } }).then((r) =>
    r.text()
  );
  const match =
    html.match(/\/images\/[^"'\\s]*logo[^"'\\s]*\.(?:png|svg|webp)/i) ??
    html.match(/logo[^"'\\s]*\.(?:png|svg)/i);
  if (match) {
    const url = match[0].startsWith('http') ? match[0] : `https://vistaenergy.com${match[0]}`;
    return download('vista', url);
  }
  throw new Error('not found');
}

async function scrapeMadalena() {
  const html = await fetch('https://www.madalenaenergy.com/', { headers: { 'User-Agent': UA } }).then((r) =>
    r.text()
  );
  const match = html.match(/https?:\/\/[^"'\\s]+logo[^"'\\s]*\.(?:png|svg|webp)/i);
  if (match) return download('madalena', match[0]);
  throw new Error('not found');
}

async function scrapeGyp() {
  const html = await fetch('https://www.gyp.com.ar/', { headers: { 'User-Agent': UA } }).then((r) =>
    r.text()
  );
  const match = html.match(/https?:\/\/[^"'\\s]+logo[^"'\\s]*\.(?:png|svg|webp)/i);
  if (match) return download('gyp', match[0]);
  throw new Error('not found');
}

async function main() {
  for (const [id, url] of Object.entries(DIRECT)) {
    try {
      await download(id, url);
    } catch (error) {
      console.warn(`FAIL direct ${id}: ${error.message}`);
    }
  }

  for (const fn of [scrapeTecpetrol, scrapeVista, scrapeMadalena, scrapeGyp]) {
    try {
      await fn();
    } catch (error) {
      console.warn(`FAIL scrape: ${error.message}`);
    }
  }
}

main();
