#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privacyEs } from '../../apps/web/src/content/legal/catalog-privacy-es.ts';
import { legalTermsEs } from '../../apps/web/src/content/legal/catalog-terms-es.ts';
import { stringifyMessageValue, unflattenMessages } from './message-utils.mjs';
import { translateBatch } from './translate-service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../apps/web/src/content/legal/locales');

/** @type {Record<string, string>} */
const TARGET_LOCALES = {
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

const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 300;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {import('../../apps/web/src/content/legal/types.ts').PrivacyDocument} source */
function flattenPrivacyContent(source) {
  /** @type {Array<{ path: string; value: string }>} */
  const entries = [];

  entries.push({ path: 'title', value: source.title });
  entries.push({ path: 'lastUpdatedLabel', value: source.lastUpdatedLabel });
  entries.push({ path: 'intro', value: source.intro });
  entries.push({ path: 'arcoNote', value: source.arcoNote });
  entries.push({ path: 'backHome', value: source.backHome });

  source.sections.forEach((section, sectionIndex) => {
    entries.push({ path: `sections[${sectionIndex}].title`, value: section.title });
    section.paragraphs?.forEach((paragraph, paragraphIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].paragraphs[${paragraphIndex}]`,
        value: paragraph
      });
    });
    section.bullets?.forEach((bullet, bulletIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].bullets[${bulletIndex}]`,
        value: bullet
      });
    });
    section.orderedBullets?.forEach((bullet, bulletIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].orderedBullets[${bulletIndex}]`,
        value: bullet
      });
    });
  });

  return entries;
}

/** @param {import('../../apps/web/src/content/legal/types.ts').LegalTermsDocument} source */
function flattenLegalTermsContent(source) {
  /** @type {Array<{ path: string; value: string }>} */
  const entries = [];

  entries.push({ path: 'title', value: source.title });
  entries.push({ path: 'subtitle', value: source.subtitle });
  entries.push({ path: 'lastUpdatedLabel', value: source.lastUpdatedLabel });
  entries.push({ path: 'intro', value: source.intro });
  entries.push({ path: 'indexTitle', value: source.indexTitle });
  entries.push({ path: 'closingNote', value: source.closingNote });
  entries.push({ path: 'backHome', value: source.backHome });
  entries.push({ path: 'privacyLinkLabel', value: source.privacyLinkLabel });

  source.sections.forEach((section, sectionIndex) => {
    entries.push({ path: `sections[${sectionIndex}].title`, value: section.title });
    entries.push({ path: `sections[${sectionIndex}].summary`, value: section.summary });
    section.paragraphs?.forEach((paragraph, paragraphIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].paragraphs[${paragraphIndex}]`,
        value: paragraph
      });
    });
    section.bullets?.forEach((bullet, bulletIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].bullets[${bulletIndex}]`,
        value: bullet
      });
    });
    section.orderedBullets?.forEach((bullet, bulletIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].orderedBullets[${bulletIndex}]`,
        value: bullet
      });
    });
  });

  return entries;
}

/** @param {import('../../apps/web/src/content/legal/types.ts').PrivacyDocument} source @param {Record<string, unknown>} translated */
function mergePrivacyDocument(source, translated) {
  return {
    title: String(translated.title ?? source.title),
    lastUpdatedLabel: String(translated.lastUpdatedLabel ?? source.lastUpdatedLabel),
    lastUpdated: source.lastUpdated,
    intro: String(translated.intro ?? source.intro),
    sections: source.sections.map((section, sectionIndex) => {
      const translatedSection = /** @type {Record<string, unknown>} */ (
        Array.isArray(translated.sections) ? translated.sections[sectionIndex] : null
      );
      return {
        title: String(translatedSection?.title ?? section.title),
        paragraphs: section.paragraphs?.map((paragraph, paragraphIndex) =>
          String(
            Array.isArray(translatedSection?.paragraphs)
              ? translatedSection.paragraphs[paragraphIndex] ?? paragraph
              : paragraph
          )
        ),
        bullets: section.bullets?.map((bullet, bulletIndex) =>
          String(
            Array.isArray(translatedSection?.bullets)
              ? translatedSection.bullets[bulletIndex] ?? bullet
              : bullet
          )
        ),
        orderedBullets: section.orderedBullets?.map((bullet, bulletIndex) =>
          String(
            Array.isArray(translatedSection?.orderedBullets)
              ? translatedSection.orderedBullets[bulletIndex] ?? bullet
              : bullet
          )
        )
      };
    }),
    arcoNote: String(translated.arcoNote ?? source.arcoNote),
    backHome: String(translated.backHome ?? source.backHome),
    contactFormPath: source.contactFormPath
  };
}

/** @param {import('../../apps/web/src/content/legal/types.ts').LegalTermsDocument} source @param {Record<string, unknown>} translated */
function mergeLegalTermsDocument(source, translated) {
  return {
    title: String(translated.title ?? source.title),
    subtitle: String(translated.subtitle ?? source.subtitle),
    lastUpdatedLabel: String(translated.lastUpdatedLabel ?? source.lastUpdatedLabel),
    lastUpdated: source.lastUpdated,
    intro: String(translated.intro ?? source.intro),
    indexTitle: String(translated.indexTitle ?? source.indexTitle),
    sections: source.sections.map((section, sectionIndex) => {
      const translatedSection = /** @type {Record<string, unknown>} */ (
        Array.isArray(translated.sections) ? translated.sections[sectionIndex] : null
      );
      return {
        id: section.id,
        title: String(translatedSection?.title ?? section.title),
        summary: String(translatedSection?.summary ?? section.summary),
        paragraphs: section.paragraphs?.map((paragraph, paragraphIndex) =>
          String(
            Array.isArray(translatedSection?.paragraphs)
              ? translatedSection.paragraphs[paragraphIndex] ?? paragraph
              : paragraph
          )
        ),
        bullets: section.bullets?.map((bullet, bulletIndex) =>
          String(
            Array.isArray(translatedSection?.bullets)
              ? translatedSection.bullets[bulletIndex] ?? bullet
              : bullet
          )
        ),
        orderedBullets: section.orderedBullets?.map((bullet, bulletIndex) =>
          String(
            Array.isArray(translatedSection?.orderedBullets)
              ? translatedSection.orderedBullets[bulletIndex] ?? bullet
              : bullet
          )
        )
      };
    }),
    closingNote: String(translated.closingNote ?? source.closingNote),
    backHome: String(translated.backHome ?? source.backHome),
    privacyLinkLabel: String(translated.privacyLinkLabel ?? source.privacyLinkLabel),
    contactFormPath: source.contactFormPath
  };
}

/** @param {Array<{ path: string; value: string }>} flat @param {string} localeCode @param {string} googleCode @param {string} label */
async function translateFlatEntries(flat, localeCode, googleCode, label) {
  /** @type {Array<{ path: string; value: string }>} */
  const translatedEntries = [];

  for (let start = 0; start < flat.length; start += BATCH_SIZE) {
    const batch = flat.slice(start, start + BATCH_SIZE);
    const values = batch.map((entry) => entry.value);
    const translatedValues = await translateBatch(values, googleCode);

    batch.forEach((entry, index) => {
      translatedEntries.push({
        path: entry.path,
        value: translatedValues[index] ?? entry.value
      });
    });

    process.stdout.write(
      `\r[${localeCode}] ${label}: ${Math.min(start + BATCH_SIZE, flat.length)}/${flat.length}`
    );
    await sleep(BATCH_DELAY_MS);
  }

  process.stdout.write('\n');
  return unflattenMessages(translatedEntries);
}

/** @param {string} localeCode @param {string} googleCode */
async function translateLocale(localeCode, googleCode) {
  const privacyFlat = flattenPrivacyContent(privacyEs);
  const termsFlat = flattenLegalTermsContent(legalTermsEs);

  const privacyTranslated = await translateFlatEntries(
    privacyFlat,
    localeCode,
    googleCode,
    'privacy'
  );
  const termsTranslated = await translateFlatEntries(
    termsFlat,
    localeCode,
    googleCode,
    'terms'
  );

  return {
    privacy: mergePrivacyDocument(privacyEs, privacyTranslated),
    terms: mergeLegalTermsDocument(legalTermsEs, termsTranslated)
  };
}

/** @param {string} localeCode @param {Record<string, unknown>} privacy @param {Record<string, unknown>} terms */
async function writeLocaleFile(localeCode, privacy, terms) {
  await fs.mkdir(localesDir, { recursive: true });
  const privacyExport = `privacy${localeCode.charAt(0).toUpperCase()}${localeCode.slice(1)}`;
  const termsExport = `legalTerms${localeCode.charAt(0).toUpperCase()}${localeCode.slice(1)}`;
  const privacyBody = stringifyMessageValue(privacy, 0);
  const termsBody = stringifyMessageValue(terms, 0);
  const contents =
    "import type { LegalTermsDocument, PrivacyDocument } from '../types';\n\n" +
    `export const ${privacyExport}: PrivacyDocument = ${privacyBody};\n\n` +
    `export const ${termsExport}: LegalTermsDocument = ${termsBody};\n`;
  await fs.writeFile(path.join(localesDir, `${localeCode}.ts`), contents, 'utf8');
}

async function main() {
  const requested = process.argv.slice(2).filter((code) => code in TARGET_LOCALES);
  const locales = requested.length > 0 ? requested : Object.keys(TARGET_LOCALES);

  console.log(`Translating privacy + legal terms from Spanish into: ${locales.join(', ')}`);

  for (const localeCode of locales) {
    const googleCode = TARGET_LOCALES[localeCode];
    const { privacy, terms } = await translateLocale(localeCode, googleCode);
    await writeLocaleFile(localeCode, privacy, terms);
    console.log(`[${localeCode}] wrote content/legal/locales/${localeCode}.ts`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
