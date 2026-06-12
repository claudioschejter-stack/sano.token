#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blogArticlesEs } from '../../apps/web/src/content/blog/catalog-es.ts';
import { stringifyMessageValue, unflattenMessages } from './message-utils.mjs';
import { translateBatch } from './translate-service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../apps/web/src/content/blog/locales');

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

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 250;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {import('../../apps/web/src/content/blog/types.ts').BlogArticle} source */
function flattenArticleContent(source) {
  /** @type {Array<{ path: string; value: string }>} */
  const entries = [];

  entries.push({ path: 'title', value: source.title });
  entries.push({ path: 'description', value: source.description });
  source.keywords.forEach((keyword, index) => {
    entries.push({ path: `keywords[${index}]`, value: keyword });
  });
  source.sections.forEach((section, sectionIndex) => {
    entries.push({ path: `sections[${sectionIndex}].heading`, value: section.heading });
    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      entries.push({
        path: `sections[${sectionIndex}].paragraphs[${paragraphIndex}]`,
        value: paragraph
      });
    });
  });

  return entries;
}

/** @param {string} slug @param {import('../../apps/web/src/content/blog/types.ts').BlogArticle} source @param {Record<string, unknown>} translated */
function mergeArticle(slug, source, translated) {
  return {
    slug,
    publishedAt: source.publishedAt,
    title: String(translated.title ?? source.title),
    description: String(translated.description ?? source.description),
    keywords: Array.isArray(translated.keywords)
      ? translated.keywords.map(String)
      : source.keywords,
    sections: Array.isArray(translated.sections)
      ? translated.sections.map((section, index) => ({
          heading: String(section?.heading ?? source.sections[index]?.heading ?? ''),
          paragraphs: Array.isArray(section?.paragraphs)
            ? section.paragraphs.map(String)
            : source.sections[index]?.paragraphs ?? []
        }))
      : source.sections
  };
}

/** @param {string} localeCode @param {string} googleCode */
async function translateLocale(localeCode, googleCode) {
  const slugs = Object.keys(blogArticlesEs);
  /** @type {Record<string, unknown>} */
  const translatedCatalog = {};

  for (const slug of slugs) {
    const source = blogArticlesEs[slug];
    const flat = flattenArticleContent(source);
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
        `\r[${localeCode}] ${slug}: ${Math.min(start + BATCH_SIZE, flat.length)}/${flat.length}`
      );
      await sleep(BATCH_DELAY_MS);
    }

    process.stdout.write('\n');
    const translatedBody = unflattenMessages(translatedEntries);
    translatedCatalog[slug] = mergeArticle(slug, source, translatedBody);
  }

  return translatedCatalog;
}

/** @param {string} localeCode @param {Record<string, unknown>} catalog */
async function writeLocaleFile(localeCode, catalog) {
  await fs.mkdir(localesDir, { recursive: true });
  const exportName = `blogArticles${localeCode.charAt(0).toUpperCase()}${localeCode.slice(1)}`;
  const body = stringifyMessageValue(catalog, 0);
  const header =
    "import type { BlogArticle } from '../types';\n\n" +
    `export const ${exportName}: Record<string, BlogArticle> = `;
  await fs.writeFile(path.join(localesDir, `${localeCode}.ts`), `${header}${body};\n`, 'utf8');
}

async function main() {
  const requested = process.argv.slice(2).filter((code) => code in TARGET_LOCALES);
  const locales = requested.length > 0 ? requested : Object.keys(TARGET_LOCALES);

  console.log(`Translating ${Object.keys(blogArticlesEs).length} blog articles into: ${locales.join(', ')}`);

  for (const localeCode of locales) {
    const googleCode = TARGET_LOCALES[localeCode];
    const catalog = await translateLocale(localeCode, googleCode);
    await writeLocaleFile(localeCode, catalog);
    console.log(`[${localeCode}] wrote content/blog/locales/${localeCode}.ts`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
