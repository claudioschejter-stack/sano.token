import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/logos/operators');
const UA = 'Mozilla/5.0';

async function save(name, url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(outDir, name), buffer);
  console.log('OK', name, buffer.length);
}

const html = await fetch('https://companieslogo.com/ypf/logo/', { headers: { 'User-Agent': UA } }).then((r) =>
  r.text()
);
const svg = html.match(/https:\/\/companieslogo\.com\/img\/orig\/YPF[^"'\\s]+\.svg[^"'\\s]*/i)?.[0]?.replace(
  /&amp;/g,
  '&'
);
if (svg) await save('ypf.svg', svg);

const site = await fetch('https://www.ypf.com/', { headers: { 'User-Agent': UA } }).then((r) => r.text());
const logo = site.match(/src=["']([^"']*logo[^"']*\.(?:png|svg|webp))["']/i)?.[1];
if (logo) {
  const url = logo.startsWith('http') ? logo : `https://www.ypf.com${logo.startsWith('/') ? '' : '/'}${logo}`;
  await save('ypf-site.png', url).catch(() => {});
}
