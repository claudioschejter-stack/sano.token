import fs from 'node:fs';

const target = process.argv[2];
if (!target) {
  process.exit(1);
}

const tag = 'div';
let source = fs.readFileSync(target, 'utf8');
source = source.replaceAll('<motion', `<${tag}`);
source = source.replaceAll(`</motion>`, `</${tag}>`);
fs.writeFileSync(target, source);
