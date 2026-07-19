/** Click de Pago (Tecnología Macro / PlusPagos) API + webhook types. */

export type MacroClickApiResponse<T = unknown> = {
  status?: boolean | number | string;
  code?: number | string;
  message?: string;
  data?: T;
  errors?: unknown;
};

export type MacroClickSession = {
  token: string;
  expiresAtMs: number;
};

export type MacroClickTransaction = {
  TransaccionPlataformaId?: string | number;
  TransaccionComercioId?: string;
  Monto?: string | number;
  Estado?: string;
  EstadoId?: string | number;
  MedioPago?: string | number;
  MarcaTarjeta?: string;
  FechaTransaccion?: string;
  FechaPago?: string;
  Cuotas?: string | number;
  Detalle?: string;
  InformacionPagador?: MacroClickPayerInfo;
  ProductoTransaccion?: Array<{ Nombre?: string; Monto?: string | number }>;
  InformacionAdicional?: string;
};

export type MacroClickPayerInfo = {
  Email?: string | null;
  Nombre?: string | null;
  NumeroDocumento?: string | null;
  Telefono?: string | null;
  TipoDocumento?: string | null;
};

export type MacroClickPaymentMethod = {
  id?: string | number;
  codigo?: string | number;
  nombre?: string;
  descripcion?: string;
};

export type MacroClickCaja = {
  id?: string | number;
  codigo?: string;
  nombre?: string;
  activa?: boolean;
};

export type MacroClickOrder = {
  id?: string | number;
  codigoCaja?: string;
  monto?: string | number;
  estado?: string;
  qr?: string;
  qrUrl?: string;
};

export type MacroClickDebinRequest = {
  cuit: string;
  cbuOrAlias: string;
  amountCents: number;
  commerceTransactionId: string;
  concept?: string;
};

export type MacroClickLinkPagoRequest = {
  amountCents: number;
  commerceTransactionId: string;
  description?: string;
  notificationUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
  currency?: 'ARS' | 'USD';
  additionalInfo?: Record<string, unknown>;
};

export type MacroClickLinkPago = {
  id?: string;
  url?: string;
  link?: string;
  expiresAt?: string;
};

export type MacroClickQrRequest = {
  amountCents: number;
  commerceTransactionId: string;
  description?: string;
  notificationUrl?: string;
};

export type MacroClickQrMultiDueRequest = {
  commerceTransactionId: string;
  description?: string;
  notificationUrl?: string;
  dues: Array<{ dueDate: string; amountCents: number }>;
};

export type MacroClickWebhookTipo =
  | 'PAGO'
  | 'TRANSACCION'
  | 'TRANSACCIÓN'
  | 'DEVOLUCION'
  | 'DEVOLUCIÓN'
  | string;

/** Botón / API notification payload (EstadoId codes from Macro manual). */
export type MacroClickWebhookPayload = {
  Tipo?: MacroClickWebhookTipo;
  type?: string;
  TransaccionPlataformaId?: string | number;
  TransaccionComercioId?: string;
  Monto?: string | number;
  Estado?: string;
  EstadoId?: string | number;
  Detalle?: string;
  MedioPago?: string | number;
  MetodoPago?: string | null;
  Cuotas?: string | number;
  MarcaTarjeta?: string;
  FechaTransaccion?: string;
  FechaPago?: string;
  InformacionPagador?: MacroClickPayerInfo;
  InformacionAdicional?: string;
  ProductoTransaccion?: Array<{ Nombre?: string; Monto?: string | number }>;
  [key: string]: unknown;
};

export const MACRO_CLICK_ESTADO = {
  CREADA: 1,
  EN_PAGO: 2,
  REALIZADA: 3,
  RECHAZADA: 4,
  EXPIRADA: 7,
  CANCELADA: 8,
  DEVUELTA: 9,
  PENDIENTE: 10,
  VENCIDA: 11
} as const;

export type MacroClickCheckoutProduct = {
  name: string;
  amountCents?: number;
};

export type MacroClickCheckoutFormFields = {
  actionUrl: string;
  Comercio: string;
  SucursalComercio: string;
  TransaccionComercioId: string;
  Monto: string;
  Hash: string;
  CallbackSuccess: string;
  CallbackCancel: string;
  CallbackPending?: string;
  Informacion?: string;
  UserId?: string;
  'ClientData.CUIT'?: string;
  'ClientData.NombreApellido'?: string;
  Producto: string[];
  MontoProducto?: string[];
};

/** Sanova-internal commerce refs for webhook routing. */
export type MacroClickCommerceRef =
  | { kind: 'deposit'; depositId: string }
  | { kind: 'cart'; batchId: string }
  | { kind: 'rent'; projectId: string; periodKey: string; tenantKey?: string; currency: 'ARS' | 'USD' };
