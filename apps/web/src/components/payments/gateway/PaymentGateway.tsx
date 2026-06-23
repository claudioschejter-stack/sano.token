'use client';

import { Building2, CreditCard, Globe2, Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePaymentRouting } from '../../../hooks/usePaymentRouting';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { PaymentRouteId } from '../../../lib/checkout/paymentRouteTypes';
import { normalizePaymentCountry } from '../../../lib/payments/paymentCountry';
import { BridgeTransferInstructions } from './BridgeTransferInstructions';
import { GlobalRetailOnRampPanel } from './GlobalRetailOnRampPanel';
import { LocalArgentinaPaymentPanel } from './LocalArgentinaPaymentPanel';
import { PaymentGatewayToast } from './PaymentGatewayToast';

export type PaymentGatewayProps = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
  fallbackCurrency?: string;
  className?: string;
  onFunded?: () => void;
  onError?: (message: string) => void;
};

const ROUTE_ICONS: Record<PaymentRouteId, typeof CreditCard> = {
  global_retail: CreditCard,
  global_institutional: Building2,
  local_fiat: Smartphone
};

export function PaymentGateway({
  amountUsd,
  referenceId,
  investorName,
  fallbackCurrency = 'USD',
  className = '',
  onFunded,
  onError
}: PaymentGatewayProps) {
  const t = useTranslation();
  const g = t.paymentGateway;
  const {
    countryCode,
    isMobile,
    isArgentina,
    availableRoutes,
    activeRoute,
    setSelectedRoute,
    localProvider,
    setLocalProvider
  } = usePaymentRouting({ fallbackCurrency });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const routeLabels = useMemo(
    () =>
      ({
        global_retail: { title: g.routeGlobalRetail, description: g.routeGlobalRetailDesc },
        global_institutional: {
          title: g.routeGlobalInstitutional,
          description: g.routeGlobalInstitutionalDesc
        },
        local_fiat: { title: g.routeLocalFiat, description: g.routeLocalFiatDesc }
      }) as Record<PaymentRouteId, { title: string; description: string }>,
    [g]
  );

  const countryLabel = normalizePaymentCountry(countryCode);

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-terminal-text">
          <Globe2 size={14} className="text-terminal-primary" />
          {g.countryDetected.replace('{country}', countryLabel)}
        </div>
        <p className="mt-1 text-[11px] text-terminal-muted">{g.countryHint}</p>
        <p className="mt-1 text-[11px] text-terminal-muted">
          {isMobile ? g.deviceMobile : g.deviceDesktop}
        </p>
      </div>

      <div className="grid gap-2">
        {availableRoutes.map((routeId) => {
          const Icon = ROUTE_ICONS[routeId];
          const meta = routeLabels[routeId];
          const active = activeRoute === routeId;

          return (
            <button
              key={routeId}
              type="button"
              onClick={() => setSelectedRoute(routeId)}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                active
                  ? 'border-terminal-primary bg-terminal-primary/5'
                  : 'border-terminal-border bg-white hover:border-terminal-primary/40'
              }`}
            >
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-2 text-terminal-primary">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-terminal-text">{meta.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-terminal-muted">{meta.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {activeRoute === 'global_retail' ? (
        <GlobalRetailOnRampPanel
          amountUsd={amountUsd}
          countryCode={countryCode}
          labels={{
            title: g.globalRetailTitle,
            subtitle: g.globalRetailSubtitle,
            cta: g.globalRetailCta,
            providers: g.globalRetailProviders,
            loading: g.globalRetailLoading
          }}
          onFunded={onFunded}
          onError={onError}
        />
      ) : null}

      {activeRoute === 'global_institutional' ? (
        <BridgeTransferInstructions
          amountUsd={amountUsd}
          referenceId={referenceId}
          investorName={investorName}
          labels={{
            title: g.bridgeTitle,
            subtitle: g.bridgeSubtitle,
            bankName: g.bridgeBankName,
            accountName: g.bridgeAccountName,
            accountNumber: g.bridgeAccountNumber,
            routingNumber: g.bridgeRoutingNumber,
            swift: g.bridgeSwift,
            beneficiaryAddress: g.bridgeBeneficiaryAddress,
            reference: g.bridgeReference,
            amount: g.bridgeAmount,
            memo: g.bridgeMemo,
            settlement: g.bridgeSettlement,
            copy: g.copy,
            copied: g.copied,
            simulatedNotice: g.bridgeSimulatedNotice
          }}
        />
      ) : null}

      {activeRoute === 'local_fiat' && isArgentina ? (
        <LocalArgentinaPaymentPanel
          amountUsd={amountUsd}
          referenceId={referenceId}
          isMobile={isMobile}
          selectedProvider={localProvider}
          onSelectProvider={setLocalProvider}
          onMaintenanceToast={setToastMessage}
          labels={{
            title: g.localArgentinaTitle,
            mercadopago: g.localMercadoPago,
            modo: g.localModo,
            lemon: g.localLemon,
            maintenanceToast: g.localMaintenanceToast,
            mpTitle: g.mpTitle,
            mpDesktopHint: g.mpDesktopHint,
            mpMobileHint: g.mpMobileHint,
            mpLoading: g.mpLoading,
            mpError: g.mpError,
            mpAmountLocal: g.mpAmountLocal,
            mpOpenApp: g.mpOpenApp
          }}
          onError={onError}
        />
      ) : null}

      <p className="text-[10px] text-terminal-muted">{g.treasuryFootnote}</p>

      <PaymentGatewayToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </section>
  );
}
