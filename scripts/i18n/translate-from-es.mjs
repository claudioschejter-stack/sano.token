import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { es } from '../../apps/web/src/i18n/locales/es.ts';
import {
  flattenMessages,
  stringifyMessageValue,
  unflattenMessages
} from './message-utils.mjs';
import { translateBatch } from './translate-service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../apps/web/src/i18n/locales');

/** @type {Record<string, string>} */
const TARGET_LOCALES = {
  en: 'en',
  zh: 'zh-cn',
  hi: 'hi',
  fr: 'fr',
  ar: 'ar',
  bn: 'bn',
  pt: 'pt',
  ru: 'ru',
  ur: 'ur',
  id: 'id',
  de: 'de',
  ja: 'ja',
  sw: 'sw',
  mr: 'mr'
};

const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 250;

const flatSource = flattenMessages(es);

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {string} localeCode */
async function isLocaleUntranslated(localeCode) {
  const content = await fs.readFile(path.join(localesDir, `${localeCode}.ts`), 'utf8');
  return (
    content.includes('buyNow: "Comprar Ahora"') ||
    content.includes("buyNow: 'Comprar Ahora'")
  );
}

/** @param {string[]} requested */
async function resolveLocalesToTranslate(requested) {
  if (requested.length > 0) {
    return requested.filter((code) => code in TARGET_LOCALES);
  }

  const untranslated = [];
  for (const localeCode of Object.keys(TARGET_LOCALES)) {
    if (await isLocaleUntranslated(localeCode)) {
      untranslated.push(localeCode);
    }
  }

  return untranslated;
}

/** @param {typeof flatSource} entries @param {string} localeCode @param {string} googleCode */
async function translateLocale(entries, localeCode, googleCode) {
  /** @type {Array<{ path: string; value: string }>} */
  const translatedEntries = [];

  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = entries.slice(start, start + BATCH_SIZE);
    const values = batch.map((entry) => entry.value);
    const translatedValues = await translateBatch(values, googleCode);

    batch.forEach((entry, index) => {
      translatedEntries.push({
        path: entry.path,
        value: translatedValues[index] ?? entry.value
      });
    });

    process.stdout.write(
      `\r[${localeCode}] ${Math.min(start + BATCH_SIZE, entries.length)}/${entries.length}`
    );
    await sleep(BATCH_DELAY_MS);
  }

  process.stdout.write('\n');
  return unflattenMessages(translatedEntries);
}

/** @param {string} localeCode @param {Record<string, unknown>} messages */
async function writeLocaleFile(localeCode, messages) {
  const exportName = localeCode;
  const body = stringifyMessageValue(messages, 0);
  const contents =
    localeCode === 'en'
      ? `${body};\n\nexport type Messages = typeof en;\n`
      : `${body} satisfies Messages;\n`;

  if (localeCode === 'en') {
    const enPath = path.join(localesDir, 'en.ts');
    await fs.writeFile(enPath, `export const en = ${contents}`, 'utf8');
    return;
  }

  const filePath = path.join(localesDir, `${localeCode}.ts`);
  const header = "import type { Messages } from './en';\n\n" + `export const ${exportName} = `;
  await fs.writeFile(filePath, `${header}${contents}`, 'utf8');
}

async function main() {
  const requested = process.argv.slice(2);
  const locales = await resolveLocalesToTranslate(requested);

  if (locales.length === 0) {
    console.log('All locales are already translated.');
    return;
  }

  console.log(
    `Translating ${flatSource.length} strings from Spanish into: ${locales.join(', ')}`
  );

  for (const localeCode of locales) {
    const googleCode = TARGET_LOCALES[localeCode];
    const translated = await translateLocale(flatSource, localeCode, googleCode);
    await writeLocaleFile(localeCode, translated);
    console.log(`[${localeCode}] wrote locales/${localeCode}.ts`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
