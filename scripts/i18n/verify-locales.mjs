import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { es } from '../../apps/web/src/i18n/locales/es.ts';
import { flattenMessages } from './message-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../apps/web/src/i18n/locales');

const esKeys = new Set(flattenMessages(es).map((entry) => entry.path));
const localeFiles = (await fs.readdir(localesDir)).filter(
  (name) => name.endsWith('.ts') && !['mergeLocale.ts'].includes(name)
);

let failures = 0;

for (const file of localeFiles) {
  const code = file.replace('.ts', '');
  const content = await fs.readFile(path.join(localesDir, file), 'utf8');
  const spanishLeak =
    content.includes('buyNow: "Comprar Ahora"') || content.includes("buyNow: 'Comprar Ahora'");

  if (code !== 'es' && spanishLeak) {
    console.log(`FAIL ${code}: contains untranslated Spanish (Comprar Ahora)`);
    failures += 1;
    continue;
  }

  if (code === 'en' || code === 'es') {
    console.log(`OK ${code}: canonical catalog`);
    continue;
  }

  if (!content.includes('blog:')) {
    console.log(`WARN ${code}: missing blog namespace (falls back to English)`);
  } else {
    console.log(`OK ${code}: blog namespace present`);
  }
}

console.log(`\nSpanish source keys: ${esKeys.size}`);
console.log(failures === 0 ? 'Verification passed.' : `Verification failed (${failures} locales).`);
if (failures > 0) {
  process.exit(1);
}
