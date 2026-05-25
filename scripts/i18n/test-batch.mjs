import { translate } from 'google-translate-api-x';

const input = [
  'Comprar Ahora',
  'Marketplace',
  'Invertí en cuatro pasos',
  'Cerrar Sesión',
  'Panel de Operaciones'
];

const result = await translate(input, { from: 'es', to: 'ru' });
console.log(JSON.stringify(result, null, 2));
