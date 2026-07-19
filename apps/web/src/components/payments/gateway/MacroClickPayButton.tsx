'use client';

import { useState } from 'react';
import { MacroClickCheckoutForm, type MacroClickFormFields } from './MacroClickCheckoutForm';

type Props = {
  referenceId: string;
  referenceKind: 'deposit' | 'cart';
  amountUsd: number;
  currency?: 'ARS' | 'USD';
  label?: string;
  redirectPath?: string;
  onError?: (message: string) => void;
};

/** Fetches encrypted Macro form fields and auto-POSTs to Click de Pago. */
export function MacroClickPayButton({
  referenceId,
  referenceKind,
  amountUsd,
  currency = 'ARS',
  label,
  redirectPath,
  onError
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formFields, setFormFields] = useState<MacroClickFormFields | null>(null);

  async function startCheckout() {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/macro-click-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceId,
          referenceKind,
          amountUsd,
          currency,
          label,
          redirectPath
        })
      });
      const body = (await res.json().catch(() => null)) as {
        formFields?: MacroClickFormFields;
        error?: string;
      } | null;
      if (!res.ok || !body?.formFields) {
        throw new Error(body?.error ?? 'MACRO_CLICK_CHECKOUT_FAILED');
      }
      setFormFields(body.formFields);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'MACRO_CLICK_CHECKOUT_FAILED');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading || Boolean(formFields)}
        onClick={() => void startCheckout()}
        className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading || formFields
          ? 'Redirigiendo a Banco Macro…'
          : currency === 'USD'
            ? 'Pagar con Macro (USD)'
            : 'Pagar con Macro (ARS)'}
      </button>
      {formFields ? <MacroClickCheckoutForm formFields={formFields} autoSubmit /> : null}
    </div>
  );
}
