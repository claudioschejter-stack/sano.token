#!/usr/bin/env node
/** Patch locale files written before new keys were added to es (footer.blog, blog namespace). */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { en } from '../../apps/web/src/i18n/locales/en.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../apps/web/src/i18n/locales');

const targets = (await fs.readdir(localesDir))
  .filter((name) => name.endsWith('.ts') && !['en.ts', 'es.ts', 'mergeLocale.ts'].includes(name));

for (const file of targets) {
  const filePath = path.join(localesDir, file);
  let content = await fs.readFile(filePath, 'utf8');

  if (!content.includes('blog:') && content.includes('footer: {')) {
    content = content.replace(
      /terms: "([^"]*)"\n(\s*)}\n(\s*)},\n(\s*)contact:/,
      `terms: "$1",\n$2  blog: "${en.landing.footer.blog}",\n$2  linkedin: "${en.landing.footer.linkedin}",\n$2  youtube: "${en.landing.footer.youtube}"\n$2}\n$3},\n$4contact:`
    );
  }

  if (!content.includes('blog: {')) {
    content = content.replace(
      /(\s*)error: \{/,
      `$1blog: {\n$1  title: "${en.blog.title.replace(/"/g, '\\"')}",\n$1  subtitle: "${en.blog.subtitle.replace(/"/g, '\\"')}",\n$1  readMore: "${en.blog.readMore}",\n$1  backToBlog: "${en.blog.backToBlog}",\n$1  ctaDisclaimer: "${en.blog.ctaDisclaimer.replace(/"/g, '\\"')}",\n$1  ctaButton: "${en.blog.ctaButton}"\n$1},\n$1error: {`
    );
  }

  await fs.writeFile(filePath, content, 'utf8');
  console.log(`patched ${file}`);
}
