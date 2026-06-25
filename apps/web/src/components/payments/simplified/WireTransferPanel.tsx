'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedWireMethod } from '../../../lib/payments/checkoutBestRouteService';
import type { BridgeVirtualAccountInstructions } from '../../../lib/checkout/paymentRouteTypes';
import { BridgeTransferInstructions } from '../gateway/BridgeTransferInstructions';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

type ApiResult = {
  instructions: BridgeVirtualAccountInstructions;
  isSimulated: boolean;
};

async function fetchVirtualAccount(params: {
  referenceId: string;
  amountUsd: number;
}): Promise<ApiResult> {
  const url = new URL('/api/payments/bridge-virtual-account', window.location.origin);
  url.searchParams.set('referenceId', params.referenceId);
  url.searchParams.set('amountUsd', String(params.amountUsd));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`bridge-virtual-account error: ${res.status}`);
  return res.json() as Promise<ApiResult>;
}

type Props = {
  wire: SimplifiedWireMethod;
  amountUsd: number;
};

export function WireTransferPanel({ wire, amountUsd }: Props) {
  const t = useTranslation();
  const g = t.paymentGateway;
  const sc = t.simplifiedCheckout;

  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchVirtualAccount({
      referenceId: wire.instructions.reference,
      amountUsd: wire.totalUsd
    })
      .then(setResult)
      .catch(() => {
        setResult({ instructions: wire.instructions, isSimulated: true });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wire.instructions.reference, wire.totalUsd]);

  if (loading) {
    return (
      <section className="flex items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-card p-8">
        <Loader2 className="h-5 w-5 animate-spin text-terminal-primary" />
        <span className="text-sm text-terminal-muted">Cargando datos bancarios…</span>
      </section>
    );
  }

  const { instructions, isSimulated } = result ?? { instructions: wire.instructions, isSimulated: true };

  return (
    <div className="space-y-4">
      <BridgeTransferInstructions
        instructions={instructions}
        isSimulated={isSimulated}
        labels={{
          title: sc.wireTitle,
          subtitle: sc.wireSubtitle,
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

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={wire.totalUsd}
        feeBps={wire.feeBps}
        providerLabel="Bridge"
      />
    </div>
  );
}
