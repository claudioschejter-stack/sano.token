import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../apps/web/public/logos/operators');

const UA = 'SanovaGlobalWebsite/1.0';

/** companieslogo.com URL slug per operator. */
const COMPANIES_LOGO_SLUG = {
  ypf: 'ypf',
  chevron: 'chevron',
  shell: 'shell',
  total: 'totalenergies',
  exxon: 'exxonmobil',
  equinor: 'equinor',
  bp: 'bp',
  petronas: 'petronas',
  conocophillips: 'conocophillips',
  repsol: 'repsol',
  eni: 'eni',
  murphy: 'murphy-oil',
  apache: 'apa-corporation',
  geopark: 'geopark',
  harbour: 'harbour-energy',
  pluspetrol: 'pluspetrol',
  vista: 'vista-energy',
  madalena: 'madalena-energy'
};

/** Wikimedia Commons filenames (fallback). */
const COMMONS_FILE = {
  ypf: 'YPF logo 2012.png',
  chevron: 'Chevron Logo.svg',
  shell: 'Shell logo.svg',
  total: 'TotalEnergies logo.svg',
  exxon: 'ExxonMobil Logo.svg',
  pae: 'Pan American Energy logo.png',
  pampa: 'Pampa Energia logo.svg',
  tecpetrol: 'Tecpetrol logo.svg',
  cgc: 'CGC logo Argentina.png',
  equinor: 'Equinor.svg',
  bp: 'BP Helios logo.svg',
  geopark: 'GeoPark Limited logo.png',
  qatarenergy: 'QatarEnergy logo.svg',
  petronas: 'Petronas Logo.svg',
  gyp: 'GYP logo.png',
  murphy: 'Murphy Oil logo.svg',
  conocophillips: 'ConocoPhillips logo.svg',
  repsol: 'Repsol logo.svg',
  eni: 'Logo Eni.svg',
  apache: 'Apache Corporation logo.svg',
  harbour: 'Harbour Energy logo.svg',
  pluspetrol: 'Pluspetrol logo.svg',
  vista: 'Vista Energy logo.png',
  madalena: 'Madalena Energy logo.png'
};

const CLEARBIT = {
  pae: 'pan-energy.com',
  pampa: 'pampa.com.ar',
  tecpetrol: 'tecpetrol.com',
  cgc: 'cgc.energy',
  gyp: 'gyp.com.ar',
  pluspetrol: 'pluspetrol.com',
  geopark: 'geopark.com',
  harbour: 'harbourenergy.com',
  madalena: 'madalenaenergy.com',
  vista: 'vistaenergy.com'
};

const ALL_IDS = [
  'ypf',
  'chevron',
  'shell',
  'total',
  'exxon',
  'pae',
  'pampa',
  'vista',
  'tecpetrol',
  'pluspetrol',
  'cgc',
  'equinor',
  'bp',
  'geopark',
  'qatarenergy',
  'petronas',
  'madalena',
  'gyp',
  'murphy',
  'conocophillips',
  'repsol',
  'eni',
  'apache',
  'harbour'
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveBuffer(id, buffer, contentType) {
  if (buffer.length < 400) throw new Error('too small');
  const ext = contentType?.includes('svg')
    ? 'svg'
    : contentType?.includes('jpeg')
      ? 'jpg'
      : 'png';
  fs.writeFileSync(path.join(outDir, `${id}.${ext}`), buffer);
  return ext;
}

async function downloadFromUrl(id, url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'image/*' },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return saveBuffer(id, buffer, response.headers.get('content-type'));
}

async function fromCompaniesLogo(id, slug) {
  const page = await fetch(`https://companieslogo.com/${slug}/logo/`, {
    headers: { 'User-Agent': UA }
  });
  if (!page.ok) throw new Error(`page HTTP ${page.status}`);
  const html = await page.text();
  const pngMatch = html.match(/https:\/\/companieslogo\.com\/img\/orig\/[A-Z0-9_.-]+\.png[^"'\\s]*/i);
  const svgMatch = html.match(/https:\/\/companieslogo\.com\/img\/orig\/[A-Z0-9_.-]+\.svg[^"'\\s]*/i);
  const url = (pngMatch?.[0] ?? svgMatch?.[0])?.replace(/&amp;/g, '&');
  if (!url) throw new Error('logo URL not found on page');
  return downloadFromUrl(id, url);
}

async function fromCommons(id, filename) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
  return downloadFromUrl(id, url);
}

async function fromClearbit(id, domain) {
  return downloadFromUrl(id, `https://logo.clearbit.com/${domain}?size=320`);
}

async function fetchLogo(id) {
  if (COMPANIES_LOGO_SLUG[id]) {
    try {
      const ext = await fromCompaniesLogo(id, COMPANIES_LOGO_SLUG[id]);
      console.log(`OK  ${id} (companieslogo) .${ext}`);
      return ext;
    } catch (error) {
      console.warn(`WARN ${id} companieslogo: ${error.message}`);
    }
  }

  if (COMMONS_FILE[id]) {
    try {
      await sleep(1500);
      const ext = await fromCommons(id, COMMONS_FILE[id]);
      console.log(`OK  ${id} (wikimedia) .${ext}`);
      return ext;
    } catch (error) {
      console.warn(`WARN ${id} wikimedia: ${error.message}`);
    }
  }

  if (CLEARBIT[id] || true) {
    const domain =
      CLEARBIT[id] ??
      {
        ypf: 'ypf.com',
        chevron: 'chevron.com',
        shell: 'shell.com',
        total: 'totalenergies.com',
        exxon: 'exxonmobil.com',
        equinor: 'equinor.com',
        bp: 'bp.com',
        petronas: 'petronas.com',
        qatarenergy: 'qatarenergy.qa',
        murphy: 'murphyoilcorp.com',
        conocophillips: 'conocophillips.com',
        repsol: 'repsol.com',
        eni: 'eni.com',
        apache: 'apacorp.com'
      }[id];
    if (!domain) throw new Error('no source');
    const ext = await fromClearbit(id, domain);
    console.log(`OK  ${id} (clearbit) .${ext}`);
    return ext;
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];

  for (const id of ALL_IDS) {
    try {
      await sleep(800);
      const ext = await fetchLogo(id);
      manifest.push({ id, file: `/logos/operators/${id}.${ext}` });
    } catch (error) {
      console.error(`FAIL ${id}: ${error.message}`);
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nDone: ${manifest.length}/${ALL_IDS.length}`);
}

main();
