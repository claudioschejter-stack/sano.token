import { es } from '../../apps/web/src/i18n/locales/es.ts';
import { flattenMessages, unflattenMessages } from './message-utils.mjs';

const flat = flattenMessages(es);
const paths = flat.map((entry) => entry.path);
const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);

console.log('total', flat.length);
console.log('duplicates', [...new Set(duplicates)]);

const roundtrip = unflattenMessages(flat);
const roundFlat = flattenMessages(roundtrip);

let mismatches = 0;
for (let index = 0; index < flat.length; index += 1) {
  if (flat[index].path !== roundFlat[index]?.path || flat[index].value !== roundFlat[index]?.value) {
    mismatches += 1;
    if (mismatches <= 5) {
      console.log('mismatch', flat[index], roundFlat[index]);
    }
  }
}

console.log('mismatches', mismatches);
