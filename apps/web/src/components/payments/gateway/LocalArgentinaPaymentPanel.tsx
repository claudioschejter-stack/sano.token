'use client';

import { Smartphone } from 'lucide-react';
import type { LocalFiatProviderId } from '../../../lib/checkout/paymentRouteTypes';
import { MercadoPagoDirectCheckout } from './MercadoPagoDirectCheckout';

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

const LOCAL_PROVIDERS: Array<{ id: LocalFiatProviderId; labelKey: 'mercadopago' | 'modo' | 'lemon' }> = [
  { id: 'mercadopago', labelKey: 'mercadopago' },
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
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
              {labels[provider.labelKey]}
            </button>
          ))}
        </div>
      </div>

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
