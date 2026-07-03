export type MercadoPagoQrMode = 'static' | 'dynamic' | 'hybrid';

export type MercadoPagoQrOrderItemInput = {
  title: string;
  unit_price: number;
  quantity: number;
  unit_measure?: string;
  external_code?: string;
};

export type CreateMercadoPagoQrOrderInput = {
  amount: number;
  description: string;
  external_reference: string;
  items: MercadoPagoQrOrderItemInput[];
  mode?: MercadoPagoQrMode;
  expiration_time?: string;
};

export type MercadoPagoQrPaymentTransaction = {
  id?: string;
  amount?: string;
  status?: string;
  status_detail?: string;
};

export type MercadoPagoQrOrderApiResponse = {
  id?: string;
  type?: string;
  external_reference?: string;
  description?: string;
  expiration_time?: string;
  total_amount?: string;
  status?: string;
  status_detail?: string;
  currency?: string;
  created_date?: string;
  last_updated_date?: string;
  config?: {
    qr?: {
      external_pos_id?: string;
      mode?: MercadoPagoQrMode;
    };
  };
  transactions?: {
    payments?: MercadoPagoQrPaymentTransaction[];
  };
  type_response?: {
    qr_data?: string;
  };
  items?: Array<Record<string, unknown>>;
};

export type MercadoPagoQrOrderRecord = {
  id: string;
  userId: string;
  mpOrderId: string;
  mpPaymentId: string | null;
  externalReference: string;
  amountArs: string;
  description: string | null;
  qrMode: string;
  status: string;
  statusDetail: string | null;
  qrData: string | null;
  expiresAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MercadoPagoQrOrderView = {
  orderId: string;
  mpOrderId: string;
  mpPaymentId: string | null;
  externalReference: string;
  amountArs: number;
  description: string | null;
  qrMode: MercadoPagoQrMode;
  status: string;
  statusDetail: string | null;
  qrData: string | null;
  showQr: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
