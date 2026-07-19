import {
  macroClickBranchId,
  macroClickCheckoutPostUrl,
  macroClickGuid,
  macroClickSecretKey
} from './config';
import {
  buildMacroClickHash,
  encryptMacroClickString,
  formatMacroClickAmountCents
} from './cryptoService';
import type { MacroClickCheckoutFormFields, MacroClickCheckoutProduct } from './types';

export type BuildMacroClickCheckoutInput = {
  commerceTransactionId: string;
  amount: number;
  products: MacroClickCheckoutProduct[];
  callbackSuccess: string;
  callbackCancel: string;
  callbackPending?: string;
  clientIp: string;
  /** Encrypted UserId for Tarjetero (card vault). */
  userId?: string | null;
  additionalInfo?: Record<string, unknown> | string | null;
  clientCuit?: string | null;
  clientName?: string | null;
  branchId?: string | null;
};

export function buildMacroClickCheckoutForm(
  input: BuildMacroClickCheckoutInput
): MacroClickCheckoutFormFields {
  const secret = macroClickSecretKey();
  const comercio = macroClickGuid();
  const sucursal = input.branchId?.trim() ?? macroClickBranchId();
  const amountCents = formatMacroClickAmountCents(input.amount);

  const encrypt = (value: string) => encryptMacroClickString(value, secret);

  const infoRaw =
    typeof input.additionalInfo === 'string'
      ? input.additionalInfo
      : input.additionalInfo
        ? JSON.stringify(input.additionalInfo)
        : '';

  const fields: MacroClickCheckoutFormFields = {
    actionUrl: macroClickCheckoutPostUrl(),
    Comercio: comercio,
    SucursalComercio: encrypt(sucursal),
    TransaccionComercioId: input.commerceTransactionId,
    Monto: encrypt(amountCents),
    Hash: buildMacroClickHash({
      clientIp: input.clientIp || '127.0.0.1',
      secretKey: secret,
      commerceGuid: comercio,
      branchId: sucursal,
      amountCents
    }),
    CallbackSuccess: encrypt(input.callbackSuccess),
    CallbackCancel: encrypt(input.callbackCancel),
    Producto: input.products.map((p) => p.name).slice(0, 20)
  };

  if (input.callbackPending) {
    fields.CallbackPending = encrypt(input.callbackPending);
  }
  if (infoRaw) {
    fields.Informacion = encrypt(infoRaw);
  }
  if (input.userId?.trim()) {
    fields.UserId = encrypt(input.userId.trim());
  }
  if (input.clientCuit?.trim()) {
    fields['ClientData.CUIT'] = input.clientCuit.replace(/-/g, '').trim();
  }
  if (input.clientName?.trim()) {
    fields['ClientData.NombreApellido'] = input.clientName.trim();
  }

  const productAmounts = input.products
    .map((p) => (typeof p.amountCents === 'number' ? String(p.amountCents) : null))
    .filter((v): v is string => Boolean(v));
  if (productAmounts.length === input.products.length && productAmounts.length > 0) {
    fields.MontoProducto = productAmounts;
  }

  return fields;
}
