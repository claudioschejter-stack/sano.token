const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src/i18n/locales');

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.ts') || file === 'mergeLocale.ts') {
    continue;
  }

  const filePath = path.join(dir, file);
  let source = fs.readFileSync(filePath, 'utf8');
  const fixed = source.replace(/",\r,/g, '",').replace(/"\r,/g, '",');

  if (fixed !== source) {
    fs.writeFileSync(filePath, fixed);
    console.log(`fixed ${file}`);
  }
}
