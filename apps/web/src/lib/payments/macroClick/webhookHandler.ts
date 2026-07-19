import { dispatchApprovedLocalWalletPayment } from '../localWalletWebhookSettlement';
import { decodeMacroClickCommerceRef, resolveMacroClickPaymentReference } from './commerceRef';
import {
  isMacroClickPaymentFailed,
  isMacroClickPaymentSuccessful,
  settleMacroClickRentPayment
} from './rentSettlement';
import type { MacroClickWebhookPayload } from './types';

export async function handleMacroClickWebhook(payload: MacroClickWebhookPayload) {
  const tipo = String(payload.Tipo ?? payload.type ?? '').toUpperCase();
  const commerceId = String(payload.TransaccionComercioId ?? '').trim();

  if (tipo.includes('DEVOLUC')) {
    return {
      ok: true,
      handled: 'refund_notification',
      commerceId,
      estado: payload.Estado ?? null
    };
  }

  const ref = decodeMacroClickCommerceRef(commerceId);

  if (ref?.kind === 'rent') {
    if (!isMacroClickPaymentSuccessful(payload)) {
      return {
        ok: true,
        handled: 'rent_not_paid',
        commerceId,
        estado: payload.Estado ?? null,
        failed: isMacroClickPaymentFailed(payload)
      };
    }
    const settled = await settleMacroClickRentPayment({ ref, payload });
    return { ok: settled.ok, handled: 'rent', commerceId, ...settled };
  }

  const paymentRef = resolveMacroClickPaymentReference(commerceId) ?? commerceId;
  if (!paymentRef) {
    return { ok: true, ignored: 'missing_commerce_id' };
  }

  if (isMacroClickPaymentSuccessful(payload)) {
    return dispatchApprovedLocalWalletPayment({
      externalReference: paymentRef,
      provider: 'macro_click',
      providerPaymentId: String(payload.TransaccionPlataformaId ?? paymentRef),
      payload: { ...payload, provider: 'macro_click' }
    });
  }

  if (isMacroClickPaymentFailed(payload)) {
    const { dispatchPaymentWebhook } = await import('../paymentWebhookDispatch');
    return dispatchPaymentWebhook({
      externalReference: paymentRef,
      provider: 'macro_click',
      providerPaymentId: String(payload.TransaccionPlataformaId ?? paymentRef),
      paid: false,
      failed: true,
      payload: { ...payload, provider: 'macro_click' }
    });
  }

  return {
    ok: true,
    ignored: 'pending_or_unknown_state',
    estado: payload.Estado ?? null,
    estadoId: payload.EstadoId ?? null
  };
}
