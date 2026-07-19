'use client';

import { Smartphone } from 'lucide-react';
import type { LocalFiatProviderId } from '../../../lib/checkout/paymentRouteTypes';
import { MercadoPagoDirectCheckout } from './MercadoPagoDirectCheckout';
import { MacroClickPayButton } from './MacroClickPayButton';

type LocalArgentinaPaymentPanelProps = {
  amountUsd: number;
  referenceId: string;
  isMobile: boolean;
  selectedProvider: LocalFiatProviderId | null;
  onSelectProvider: (provider: LocalFiatProviderId) => void;
  onMaintenanceToast: (message: string) => void;
  labels: {
    title: string;
    mercadopago: string;
    modo: string;
    lemon: string;
    macroClick?: string;
    maintenanceToast: string;
    mpTitle: string;
    mpDesktopHint: string;
    mpMobileHint: string;
    mpLoading: string;
    mpError: string;
    mpAmountLocal: string;
    mpOpenApp: string;
  };
  onError?: (message: string) => void;
};

const LOCAL_PROVIDERS: Array<{
  id: LocalFiatProviderId;
  labelKey: 'mercadopago' | 'modo' | 'lemon' | 'macroClick';
}> = [
  { id: 'mercadopago', labelKey: 'mercadopago' },
  { id: 'macro_click', labelKey: 'macroClick' },
  { id: 'modo', labelKey: 'modo' },
  { id: 'lemon', labelKey: 'lemon' }
];

export function LocalArgentinaPaymentPanel({
  amountUsd,
  referenceId,
  isMobile,
  selectedProvider,
  onSelectProvider,
  onMaintenanceToast,
  labels,
  onError
}: LocalArgentinaPaymentPanelProps) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-terminal-text">{labels.title}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LOCAL_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                onSelectProvider(provider.id);
                if (provider.id === 'modo' || provider.id === 'lemon') {
                  onMaintenanceToast(labels.maintenanceToast);
                }
              }}
              className={`rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${
                selectedProvider === provider.id
                  ? 'border-terminal-primary bg-terminal-primary/10 text-terminal-primary'
                  : 'border-terminal-border bg-white text-terminal-text hover:border-terminal-primary/40'
              }`}
            >
              {provider.labelKey === 'macroClick'
                ? labels.macroClick ?? 'Banco Macro'
                : labels[provider.labelKey]}
            </button>
          ))}
        </div>
      </div>

      {selectedProvider === 'macro_click' ? (
        <MacroClickPayButton
          referenceId={referenceId}
          referenceKind="deposit"
          amountUsd={amountUsd}
          currency="ARS"
          onError={onError}
        />
      ) : null}

      {selectedProvider === 'mercadopago' ? (
        <MercadoPagoDirectCheckout
          amountUsd={amountUsd}
          referenceId={referenceId}
          isMobile={isMobile}
          labels={{
            title: labels.mpTitle,
            desktopHint: labels.mpDesktopHint,
            mobileHint: labels.mpMobileHint,
            loading: labels.mpLoading,
            error: labels.mpError,
            amountLocal: labels.mpAmountLocal,
            openApp: labels.mpOpenApp
          }}
          onError={onError}
        />
      ) : selectedProvider === 'modo' || selectedProvider === 'lemon' ? (
        <div className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-3 text-xs text-terminal-muted">
          <Smartphone size={14} />
          {labels.maintenanceToast}
        </div>
      ) : null}
    </section>
  );
}
