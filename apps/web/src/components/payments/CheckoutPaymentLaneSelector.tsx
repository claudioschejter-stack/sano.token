'use client';

import { ArrowLeft, CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  type CheckoutPaymentLaneBundle,
  type CheckoutPaymentLaneId
} from '../../lib/payments/checkoutPaymentLanes';
import type { DepositPaymentOption } from '../../lib/payments/depositPaymentOptions';

type CheckoutPaymentLaneSelectorProps = {
  bundle: CheckoutPaymentLaneBundle;
  selectedLane: CheckoutPaymentLaneId | null;
  onSelectLane: (laneId: CheckoutPaymentLaneId | null) => void;
  renderOption: (option: DepositPaymentOption, displayLabel?: string) => ReactNode;
  ripioEwalletRail: string | null;
  onSelectRipioRail: (rail: string) => void;
  ripioRails: Array<{ rail: string; label: string }>;
  labels: {
    countryDetected: string;
    countryHint: string;
    laneElectronicWallet: string;
    laneElectronicWalletDesc: string;
    laneCryptoWallet: string;
    laneCryptoWalletDesc: string;
    laneCard: string;
    laneCardDesc: string;
    laneCheapest: string;
    backToLanes: string;
    feesOnBuyer: string;
    electronicWalletMenuTitle: string;
    cryptoWalletMenuTitle: string;
    cardMenuTitle: string;
    cardCheapestHint: string;
    unavailable: string;
    ripioEwalletTitle: string;
  };
  formatLocalAmount: (option: DepositPaymentOption) => string;
};

const LANE_ICONS: Record<CheckoutPaymentLaneId, typeof Wallet> = {
  electronic_wallet: Smartphone,
  crypto_wallet: Wallet,
  card: CreditCard
};

export function CheckoutPaymentLaneSelector({
  bundle,
  selectedLane,
  onSelectLane,
  renderOption,
  ripioEwalletRail,
  onSelectRipioRail,
  ripioRails,
  labels,
  formatLocalAmount
}: CheckoutPaymentLaneSelectorProps) {
  const laneLabels: Record<CheckoutPaymentLaneId, { title: string; description: string }> = {
    electronic_wallet: {
      title: labels.laneElectronicWallet,
      description: labels.laneElectronicWalletDesc
    },
    crypto_wallet: {
      title: labels.laneCryptoWallet,
      description: labels.laneCryptoWalletDesc
    },
    card: {
      title: labels.laneCard,
      description: labels.laneCardDesc
    }
  };

  if (selectedLane) {
    const laneOptions = bundle.optionsByLane[selectedLane];
    const menuTitle =
      selectedLane === 'electronic_wallet'
        ? labels.electronicWalletMenuTitle
        : selectedLane === 'crypto_wallet'
          ? labels.cryptoWalletMenuTitle
          : labels.cardMenuTitle;

    return (
      <div className="space-y-[2mm] pb-[2mm]">
        <button
          type="button"
          onClick={() => onSelectLane(null)}
          className="inline-flex items-center gap-1 text-xs font-medium text-terminal-primary hover:underline"
        >
          <ArrowLeft size={14} />
          {labels.backToLanes}
        </button>

        <p className={SECTION_TITLE}>{menuTitle}</p>
        {selectedLane === 'card' && bundle.cheapestCardBackend ? (
          <p className="text-[10px] leading-snug text-terminal-muted">
            {labels.cardCheapestHint.replace('{provider}', bundle.cheapestCardBackend.label)}
          </p>
        ) : null}

        <div className="divide-y divide-terminal-border overflow-hidden rounded-lg border border-terminal-border bg-white">
          {laneOptions.length > 0 ? (
            laneOptions.map((option) => renderOption(option))
          ) : (
            <p className="px-3 py-3 text-xs text-terminal-muted">{labels.unavailable}</p>
          )}
        </div>

        {selectedLane === 'electronic_wallet' && bundle.sections.ripioEwalletOption ? (
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
              {labels.ripioEwalletTitle}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ripioRails.map((row) => (
                <button
                  key={row.rail}
                  type="button"
                  onClick={() => onSelectRipioRail(row.rail)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    ripioEwalletRail === row.rail
                      ? 'border-terminal-primary bg-terminal-primary/10 text-terminal-primary'
                      : 'border-terminal-border bg-white text-terminal-text hover:border-terminal-primary/40'
                  }`}
                >
                  {row.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-[10px] text-terminal-muted">{labels.feesOnBuyer}</p>
      </div>
    );
  }

  return (
    <div className="space-y-[2mm] pb-[2mm]">
      <div className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2">
        <p className="text-xs font-semibold text-terminal-text">
          {labels.countryDetected.replace('{country}', bundle.countryLabel)}
        </p>
        <p className="mt-0.5 text-[10px] text-terminal-muted">{labels.countryHint}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-1">
        {bundle.laneSummaries.map((lane) => {
          const meta = laneLabels[lane.id];
          const Icon = LANE_ICONS[lane.id];
          const cheapestOption = bundle.optionsByLane[lane.id].find((row) => row.configured);
          const priceLabel =
            cheapestOption && lane.cheapestTotalLocal != null && cheapestOption.usesLocalCurrency
              ? formatLocalAmount(cheapestOption)
              : lane.cheapestTotalUsd != null
                ? `USDC ${lane.cheapestTotalUsd.toFixed(2)}`
                : null;

          return (
            <button
              key={lane.id}
              type="button"
              disabled={!lane.available}
              onClick={() => lane.available && onSelectLane(lane.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-terminal-border bg-white px-3 py-3 text-left transition-colors hover:border-terminal-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-2 text-terminal-primary">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-terminal-text">{meta.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-terminal-muted">{meta.description}</p>
                {priceLabel ? (
                  <p className="mt-1 text-[11px] font-medium text-terminal-primary">
                    {labels.laneCheapest.replace('{amount}', priceLabel)}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-amber-700">{labels.unavailable}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-terminal-muted">{labels.feesOnBuyer}</p>
    </div>
  );
}

const SECTION_TITLE = 'my-[1mm] py-0 text-[10px] font-semibold uppercase tracking-wide text-terminal-muted';
