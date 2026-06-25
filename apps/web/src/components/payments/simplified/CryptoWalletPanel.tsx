'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { useMobileWalletDetection } from '../../../hooks/useMobileWalletDetection';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { MobileAppRow } from './MobileAppRow';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

const QR_SIZE = 200;

/** USDC token contract on Base (chainId 8453) */
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/** Gas estimate on Base is negligible (~$0.001) */
const BASE_GAS_USD = 0.001;

function buildEip681Uri(treasuryAddress: string, amountUsdc: number): string {
  const uint256 = Math.round(amountUsdc * 1e6);
  return `ethereum:${USDC_BASE}@8453/transfer?address=${treasuryAddress}&uint256=${uint256}`;
}

function buildCryptoDeepLink(appId: string, treasuryAddress: string, amountUsdc: number): string {
  const eip681 = buildEip681Uri(treasuryAddress, amountUsdc);
  switch (appId) {
    case 'metamask':
      return `metamask://send?to=${treasuryAddress}&value=${amountUsdc}&token=USDC&network=base`;
    case 'trust':
      return `trust://send?to=${treasuryAddress}&amount=${amountUsdc}&token=USDC`;
    case 'coinbase_wallet':
      return `cbwallet://send?to=${treasuryAddress}&amount=${amountUsdc}&asset=USDC&network=base`;
    case 'rainbow':
      return `rainbow://send?to=${treasuryAddress}&amount=${amountUsdc}&currency=USDC&network=base`;
    default:
      return eip681;
  }
}

type Props = {
  cryptoWallet: SimplifiedCryptoWalletMethod;
  treasuryAddress: string | null;
  country: string;
  amountUsd: number;
};

export function CryptoWalletPanel({ cryptoWallet, treasuryAddress, country, amountUsd }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const { cryptoApps, isMobile, probing } = useMobileWalletDetection(country);
  const [copied, setCopied] = useState(false);

  const amountUsdc = cryptoWallet.totalUsd;
  const eip681Uri = treasuryAddress ? buildEip681Uri(treasuryAddress, amountUsdc) : null;

  const handleCopy = () => {
    if (!treasuryAddress) return;
    void navigator.clipboard.writeText(treasuryAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const visibleApps = isMobile ? cryptoApps.filter((a) => a.installed !== false) : [];

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-terminal-text">{sc.cryptoWalletTitle}</h3>
        <p className="mt-1 text-xs text-terminal-muted">
          {sc.cryptoWalletHint.replace('{amount}', amountUsdc.toFixed(2))}
        </p>
      </div>

      <p className="text-xs text-terminal-muted">{sc.cryptoWalletNetwork}</p>

      {treasuryAddress && eip681Uri ? (
        <>
          {isDesktop && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-terminal-muted">{sc.cryptoWalletQrHint}</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=10&data=${encodeURIComponent(eip681Uri)}`}
                alt={sc.cryptoWalletAddress}
                width={QR_SIZE}
                height={QR_SIZE}
                className="rounded-lg border border-terminal-border bg-white p-2"
              />
            </div>
          )}

          <div className="rounded-lg border border-terminal-border bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
              {sc.cryptoWalletAddress}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="break-all text-xs font-mono text-terminal-text">{treasuryAddress}</p>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md border border-terminal-border p-1.5 text-terminal-muted hover:text-terminal-primary"
              >
                <Copy size={14} />
              </button>
            </div>
            {copied && (
              <p className="mt-1 text-[10px] text-terminal-success">{sc.cryptoWalletCopied}</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-terminal-muted">{sc.notConfigured}</p>
      )}

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={cryptoWallet.totalUsd}
        feeBps={cryptoWallet.feeBps}
        providerLabel="Base USDC"
        networkFeeUsd={BASE_GAS_USD}
      />

      {isMobile && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
            {sc.cryptoWalletDeepLinks}
          </p>
          {probing ? (
            <p className="text-xs text-terminal-muted">{sc.probing}</p>
          ) : visibleApps.length === 0 ? (
            <p className="text-xs text-terminal-muted">No se encontraron wallets instaladas.</p>
          ) : (
            visibleApps.map((app) => (
              <MobileAppRow
                key={app.id}
                app={app}
                actionDeepLink={
                  treasuryAddress
                    ? buildCryptoDeepLink(app.id, treasuryAddress, amountUsdc)
                    : app.deepLink
                }
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
