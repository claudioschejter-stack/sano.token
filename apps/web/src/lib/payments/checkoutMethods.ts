import type { PaymentMethod } from '@sanova/database';
import { paymentGatewayConfigured, type PaymentMethodId } from './paymentConfig';

export type CheckoutMethodOption = {
  id: PaymentMethodId;
  label: string;
  description: string;
  configured: boolean;
  automatic: boolean;
  supportsDeposit: boolean;
  supportsPurchase: boolean;
};

const CHECKOUT_METHODS: CheckoutMethodOption[] = [
  {
    id: 'INTERNAL_BALANCE',
    label: 'Saldo Sanova',
    description: 'Debita fondos ya acreditados en tu billetera interna.',
    configured: true,
    automatic: true,
    supportsDeposit: false,
    supportsPurchase: true
  },
  {
    id: 'USDC_ONCHAIN',
    label: 'USDC on-chain',
    description: 'Transferencia USDC desde tu wallet; acreditación automática al confirmar la tx.',
    configured: paymentGatewayConfigured('USDC_ONCHAIN'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'STRIPE',
    label: 'Stripe',
    description: 'Tarjeta o banco internacional con confirmación por webhook.',
    configured: paymentGatewayConfigured('STRIPE'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    description: 'Pagos fiat LatAm con conciliación automática.',
    configured: paymentGatewayConfigured('MERCADO_PAGO'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'COINBASE',
    label: 'Coinbase Commerce',
    description: 'Checkout cripto / on-ramp internacional.',
    configured: paymentGatewayConfigured('COINBASE'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'TRANSAK',
    label: 'Transak',
    description: 'On-ramp global con tarjeta o transferencia.',
    configured: paymentGatewayConfigured('TRANSAK'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'RIPIO',
    label: 'Ripio',
    description: 'On-ramp ARS → USDC en Base con transferencia o Mercado Pago.',
    configured: paymentGatewayConfigured('RIPIO'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'BRIDGE',
    label: 'Bridge',
    description: 'On/off-ramp empresarial con confirmación automática.',
    configured: paymentGatewayConfigured('BRIDGE'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'CUSTODIAL_STABLECOIN',
    label: 'Stablecoin custodial',
    description: 'Depósito a wallet custodial autorizada del Fiduciario.',
    configured: paymentGatewayConfigured('CUSTODIAL_STABLECOIN'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'LOCAL_RAIL',
    label: 'Rails locales',
    description: 'dLocal / EBANX u otros rails locales habilitados.',
    configured: paymentGatewayConfigured('LOCAL_RAIL'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  },
  {
    id: 'RAMP',
    label: 'Ramp Network',
    description: 'On-ramp fiat → cripto (si está configurado).',
    configured: paymentGatewayConfigured('RAMP'),
    automatic: true,
    supportsDeposit: true,
    supportsPurchase: true
  }
];

export function listCheckoutMethods(mode: 'purchase' | 'deposit'): CheckoutMethodOption[] {
  return CHECKOUT_METHODS.filter((method) =>
    mode === 'deposit' ? method.supportsDeposit : method.supportsPurchase
  );
}

export function isCheckoutMethodConfigured(method: PaymentMethodId): boolean {
  if (method === 'INTERNAL_BALANCE') {
    return true;
  }
  return paymentGatewayConfigured(method);
}

export function parsePaymentMethod(value: string | undefined): PaymentMethod | null {
  const allowed = new Set<PaymentMethod>(CHECKOUT_METHODS.map((row) => row.id as PaymentMethod));
  if (!value || !allowed.has(value as PaymentMethod)) {
    return null;
  }
  return value as PaymentMethod;
}
