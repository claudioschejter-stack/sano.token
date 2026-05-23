import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/logos/operators');
const UA = 'Mozilla/5.0';

async function save(id, url, extHint) {
  const response = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 500) throw new Error('too small');
  const ext =
    extHint ??
    (url.includes('.svg') || response.headers.get('content-type')?.includes('svg') ? 'svg' : 'png');
  fs.writeFileSync(path.join(outDir, `${id}.${ext}`), buffer);
  console.log(`OK ${id}.${ext} (${buffer.length} bytes)`);
}

async function companiesLogoPng(id, slug) {
  const html = await fetch(`https://companieslogo.com/${slug}/logo/`, {
    headers: { 'User-Agent': UA }
  }).then((r) => r.text());
  const match = html.match(/https:\/\/companieslogo\.com\/img\/orig\/[A-Z0-9_.-]+\.png[^"'\\s]*/i);
  if (!match) throw new Error('PNG not found');
  const url = match[0].replace(/&amp;/g, '&');
  return save(id, url, 'png');
}

async function main() {
  await companiesLogoPng('vista', 'vista-oil-gas');

  try {
    await save('gyp', 'https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20de%20GyP.svg', 'svg');
  } catch {
    const html = await fetch('https://www.gypnqn.com.ar/', { headers: { 'User-Agent': UA } }).then((r) =>
      r.text()
    );
    const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (!img) throw new Error('gyp img not found');
    const url = img.startsWith('http') ? img : `https://www.gypnqn.com.ar${img.startsWith('/') ? '' : '/'}${img}`;
    await save('gyp', url, 'png');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
