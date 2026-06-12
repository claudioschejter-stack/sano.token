import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../apps/web/src/content'
);
const legalDir = path.join(contentDir, 'legal');

function extractFrom(file, varName, typeName, exportName, importBlock) {
  const src = fs.readFileSync(path.join(contentDir, file), 'utf8');
  const re = new RegExp(`const ${varName}: ${typeName} = ({[\\s\\S]*?\\n};)`);
  const match = src.match(re);
  if (!match) {
    throw new Error(`Missing ${varName} in ${file}`);
  }
  let body = match[1];
  if (body.endsWith('};')) {
    body = body.slice(0, -1);
  }
  return `import ${importBlock} from '../../lib/legal/legalConfig';\nimport type { ${typeName} } from './types';\n\nexport const ${exportName}: ${typeName} = ${body};\n`;
}

fs.mkdirSync(legalDir, { recursive: true });

fs.writeFileSync(
  path.join(legalDir, 'catalog-privacy-es.ts'),
  extractFrom(
    'privacyPolicy.ts',
    'privacyEs',
    'PrivacyDocument',
    'privacyEs',
    '{ LEGAL_CONTACT_PATH, LEGAL_SITE_URL, PRIVACY_POLICY_LAST_UPDATED_ES }'
  )
);

fs.writeFileSync(
  path.join(legalDir, 'catalog-privacy-en.ts'),
  extractFrom(
    'privacyPolicy.ts',
    'privacyEn',
    'PrivacyDocument',
    'privacyEn',
    '{ LEGAL_CONTACT_PATH, LEGAL_SITE_URL, PRIVACY_POLICY_LAST_UPDATED_EN }'
  )
);

fs.writeFileSync(
  path.join(legalDir, 'catalog-terms-es.ts'),
  extractFrom(
    'legalTerms.ts',
    'legalTermsEs',
    'LegalTermsDocument',
    'legalTermsEs',
    '{ LEGAL_CONTACT_PATH, LEGAL_SITE_URL, LEGAL_TERMS_LAST_UPDATED_ES }'
  )
);

fs.writeFileSync(
  path.join(legalDir, 'catalog-terms-en.ts'),
  extractFrom(
    'legalTerms.ts',
    'legalTermsEn',
    'LegalTermsDocument',
    'legalTermsEn',
    '{ LEGAL_CONTACT_PATH, LEGAL_SITE_URL, LEGAL_TERMS_LAST_UPDATED_EN }'
  )
);

console.log('Legal catalogs extracted.');
