import { translate } from 'google-translate-api-x';

const samples = [
  { es: 'Comprar Ahora', to: 'ru' },
  { es: 'Comprar Ahora', to: 'de' },
  { es: 'Invertí en cuatro pasos', to: 'ru' }
];

for (const { es, to } of samples) {
  try {
    const result = await translate(es, { from: 'es', to });
    console.log(`${to}:`, result.text);
  } catch (error) {
    console.log(`${to}: FAILED`, error?.message ?? error);
  }
}
