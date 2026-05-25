import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../apps/web/src/i18n/locales');
const skip = new Set(['en.ts', 'mergeLocale.ts']);

const insert = `    tokenDeployReadyHint: "Automatic issuance is active. Saving deploys the token + ERC-4626 vault on-chain (no manual addresses).",
    tokenDeployAutoPlaceholder: "Filled automatically when you save",
`;

for (const file of fs.readdirSync(localesDir)) {
  if (!file.endsWith('.ts') || skip.has(file)) continue;
  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('tokenDeployReadyHint')) continue;

  if (file === 'es.ts') {
    continue;
  }

  content = content.replace(
    /(\s+tokenDeployOptionalHint:[^\n]+\n)/,
    `$1${insert}`
  );

  content = content.replace(
    /(\s+autoDeployOnCreate:[^\n]+\n)/,
    `$1    autoDeployOnCreateEnabled: "Automatic issuance on create (enabled)",\n`
  );

  fs.writeFileSync(filePath, content);
  console.log('patched', file);
}
