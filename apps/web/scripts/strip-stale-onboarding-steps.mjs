import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');

const secondaryLocales = ['ar', 'bn', 'de', 'fr', 'hi', 'id', 'ja', 'mr', 'pt', 'ru', 'sw', 'ur', 'zh'];

const keysToRemove = new Set([
  'phoneTitle',
  'phoneDesc',
  'codeSentPhone',
  'codeSentEmail',
  'walletDesc',
  'identityOperationalNote',
  'identityWalletNote',
  'walletBullet1',
  'walletBullet2',
  'walletBullet3',
  'createCoinbaseWallet',
  'connectExistingWallet',
  'walletConnect',
  'walletConnectUnavailable'
]);

const linePattern = /^\s+([A-Za-z0-9_]+):\s/;

const whatsappReplacements = [
  {
    pattern: /E-Mail- und WhatsApp-Codes/g,
    replacement: 'E-Mail-Code'
  },
  {
    pattern: /email and WhatsApp codes/gi,
    replacement: 'email code'
  },
  {
    pattern: /correo electrónico y WhatsApp/gi,
    replacement: 'correo electrónico'
  },
  {
    pattern: /e-mail et WhatsApp/gi,
    replacement: 'e-mail'
  },
  {
    pattern: /email e WhatsApp/gi,
    replacement: 'email'
  },
  {
    pattern: /WhatsApp/g,
    replacement: 'email'
  }
];

for (const locale of secondaryLocales) {
  const filePath = path.join(localesDir, `${locale}.ts`);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const lines = content.split('\n');
  const nextLines = [];
  let inSteps = false;
  let stepsDepth = 0;
  let removed = 0;

  for (const line of lines) {
    if (!inSteps && /^\s+steps:\s*\{/.test(line)) {
      inSteps = true;
      stepsDepth = 1;
      nextLines.push(line);
      continue;
    }

    if (inSteps) {
      const openCount = (line.match(/\{/g) ?? []).length;
      const closeCount = (line.match(/\}/g) ?? []).length;
      stepsDepth += openCount - closeCount;

      const match = line.match(linePattern);
      if (match && keysToRemove.has(match[1])) {
        removed += 1;
        if (stepsDepth <= 0) {
          inSteps = false;
        }
        continue;
      }

      nextLines.push(line);

      if (stepsDepth <= 0) {
        inSteps = false;
      }
      continue;
    }

    nextLines.push(line);
  }

  content = nextLines.join('\n');

  if (content.includes('VERIFICATION_DELIVERY_FAILED')) {
    for (const { pattern, replacement } of whatsappReplacements) {
      content = content.replace(pattern, replacement);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`${locale}.ts: removed ${removed} stale onboarding.steps keys; patched delivery errors`);
  } else {
    console.log(`${locale}.ts: no changes`);
  }
}
