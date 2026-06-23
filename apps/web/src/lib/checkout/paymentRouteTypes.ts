export type PaymentRouteId = 'global_retail' | 'global_institutional' | 'local_fiat';

export type LocalFiatProviderId = 'mercadopago' | 'modo' | 'lemon';

export type PaymentRouteOption = {
  id: PaymentRouteId;
  labelKey: keyof PaymentGatewayRouteLabels;
  descriptionKey: keyof PaymentGatewayRouteLabels;
};

export type PaymentGatewayRouteLabels = {
  globalRetail: string;
  globalRetailDesc: string;
  globalInstitutional: string;
  globalInstitutionalDesc: string;
  localFiat: string;
  localFiatDesc: string;
};

export type MercadoPagoCheckoutSession = {
  preferenceId: string;
  initPoint: string;
  amountUsd: number;
  amountLocal: number;
  localCurrency: string;
  fxRate: number;
  sandbox: boolean;
};

export type BridgeVirtualAccountInstructions = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swift: string;
  beneficiaryAddress: string;
  reference: string;
  amountUsd: number;
  currency: string;
  memo: string;
  estimatedSettlement: string;
};
