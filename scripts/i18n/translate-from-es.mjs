import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import translate from 'translate-google';
import { es } from '../../apps/web/src/i18n/locales/es.ts';
import {
  flattenMessages,
  protectPlaceholders,
  restorePlaceholders,
  stringifyMessageValue,
  unflattenMessages
} from './message-utils.mjs';

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

const CONCURRENCY = 8;
const REQUEST_DELAY_MS = 80;

const flatSource = flattenMessages(es);

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {string} text @param {string} target */
async function translateOne(text, target) {
  const { protectedText, placeholders } = protectPlaceholders(text);

  try {
    const translated = await translate(protectedText, { from: 'es', to: target });
    const value = Array.isArray(translated) ? translated[0] : translated;
    return restorePlaceholders(String(value ?? protectedText), placeholders);
  } catch {
    return text;
  }
}

/** @param {typeof flatSource} entries @param {string} localeCode @param {string} googleCode */
async function translateLocale(entries, localeCode, googleCode) {
  /** @type {Array<{ path: string; value: string }>} */
  const translatedEntries = new Array(entries.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= entries.length) {
        return;
      }

      const entry = entries[index];
      translatedEntries[index] = {
        path: entry.path,
        value: await translateOne(entry.value, googleCode)
      };

      completed += 1;
      if (completed % 20 === 0 || completed === entries.length) {
        process.stdout.write(`\r[${localeCode}] ${completed}/${entries.length}`);
      }

      await sleep(REQUEST_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
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
  console.log(
    `Translating ${flatSource.length} strings from Spanish into ${Object.keys(TARGET_LOCALES).length} locales (one-by-one, concurrency ${CONCURRENCY})…`
  );

  for (const [localeCode, googleCode] of Object.entries(TARGET_LOCALES)) {
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
