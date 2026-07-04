export type CreateMercadoPagoPixPaymentInput = {
  amount: number;
  description: string;
  external_reference: string;
  payerEmail?: string;
};

export type MercadoPagoPixPaymentApiResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  description?: string;
  external_reference?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export type MercadoPagoPixPaymentRecord = {
  id: string;
  userId: string;
  mpPaymentId: string;
  externalReference: string;
  amountBrl: string;
  description: string | null;
  status: string;
  statusDetail: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiresAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MercadoPagoPixPaymentView = {
  paymentId: string;
  mpPaymentId: string;
  externalReference: string;
  amountBrl: number;
  description: string | null;
  status: string;
  statusDetail: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
