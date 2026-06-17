import type { DepositPaymentOption } from './depositPaymentOptions';

export type SmartCheckoutPresentation = {
  tokenAmountUsdc: number;
  bestOptionId: string | null;
  headline: string;
  subheadline: string;
  feeDisclosure: string;
  showAlternativesLabel: string;
};

const GROUP_HEADLINES: Record<string, string> = {
  linked_wallet: 'Pagá en USDC (Base) desde tu billetera',
  argentina: 'Opción recomendada para Argentina',
  global_cards: 'Tarjeta o wallet digital',
  latam: 'Pago local en tu moneda',
  asia: 'Pago local en tu moneda',
  international: 'Transferencia internacional'
};

export function buildSmartCheckoutPresentation(input: {
  amountUsd: number;
  localCurrency: string;
  bestOption: DepositPaymentOption | null;
}): SmartCheckoutPresentation {
  const best = input.bestOption;
  const tokenAmountUsdc = input.amountUsd;

  if (!best) {
    return {
      tokenAmountUsdc,
      bestOptionId: null,
      headline: 'Sin métodos de pago disponibles',
      subheadline: 'Contactá soporte para habilitar cobros en tu país.',
      feeDisclosure: 'Los costos de conversión y red los cubre el comprador.',
      showAlternativesLabel: 'Ver otras opciones'
    };
  }

  const fiatPart =
    best.usesLocalCurrency && best.totalLocal != null
      ? `${best.totalLocal.toLocaleString('es-AR', {
          style: 'currency',
          currency: best.displayCurrency,
          maximumFractionDigits: 2
        })}`
      : `$${best.totalUsd.toFixed(2)} USD`;

  const headline = GROUP_HEADLINES[best.groupId] ?? 'Mejor opción para tu país';
  const subheadline = `${best.label} · Total ${fiatPart} · Token en USDC (Base): ${tokenAmountUsdc.toFixed(2)}`;

  return {
    tokenAmountUsdc,
    bestOptionId: best.id,
    headline,
    subheadline,
    feeDisclosure:
      'Comisiones de pasarela, conversión fiat→USDC y gas en Base están incluidas en el total. Los tokens RWA se acreditan cuando el USDC llega al tesoro.',
    showAlternativesLabel: 'Ver otras formas de pago'
  };
}
