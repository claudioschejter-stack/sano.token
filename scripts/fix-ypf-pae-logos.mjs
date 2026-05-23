import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/logos/operators');
const UA = 'Mozilla/5.0';

async function download(url, file) {
  const response = await fetch(url.replace(/&amp;/g, '&'), {
    headers: { 'User-Agent': UA },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(outDir, file), buffer);
  console.log('OK', file, buffer.length);
}

const ypfHtml = await fetch('https://companieslogo.com/ypf/logo/', { headers: { 'User-Agent': UA } }).then(
  (r) => r.text()
);
const ypfPng = ypfHtml.match(/https:\/\/companieslogo\.com\/img\/orig\/YPF-[A-Z0-9]+\.png[^"'\\s]*/i)?.[0];
if (ypfPng) await download(ypfPng, 'ypf.png');

const paeHtml = await fetch('https://www.pan-energy.com/', { headers: { 'User-Agent': UA } }).then((r) =>
  r.text()
);
const paeUrls = [...paeHtml.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
const logoPath = paeUrls.find((u) => /logo/i.test(u));
if (logoPath) {
  const url = logoPath.startsWith('http')
    ? logoPath
    : `https://www.pan-energy.com${logoPath.startsWith('/') ? '' : '/'}${logoPath}`;
  await download(url, 'pae.png');
}
