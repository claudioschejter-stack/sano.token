'use client';

import { BridgeTransferInstructions } from '../gateway/BridgeTransferInstructions';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedWireMethod } from '../../../lib/payments/checkoutBestRouteService';

type Props = {
  wire: SimplifiedWireMethod;
};

export function WireTransferPanel({ wire }: Props) {
  const t = useTranslation();
  const g = t.paymentGateway;
  const sc = t.simplifiedCheckout;

  return (
    <BridgeTransferInstructions
      amountUsd={wire.totalUsd}
      referenceId={wire.instructions.reference}
      investorName={wire.instructions.accountName}
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
  );
}
