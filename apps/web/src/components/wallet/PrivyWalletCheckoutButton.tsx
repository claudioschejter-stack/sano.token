'use client';

import { Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from '../../i18n/LocaleProvider';
import { formatMessage } from '../../i18n';
import { BASE_CHAIN_ID } from '../../lib/web3/config';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../hooks/usePrivyWalletLink';

export type PrivyWalletCheckoutButtonProps = {
  className?: string;
  disabled?: boolean;
  onLinked?: () => void | Promise<void>;
};

export function PrivyWalletCheckoutButton({
  className = '',
  disabled = false,
  onLinked
}: PrivyWalletCheckoutButtonProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { address, chainId } = useAccount();
  const { enabled, ready, authenticated, address: privyAddress } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet, linking, error: linkError } = usePrivyWalletLink();

  const activeAddress = address ?? privyAddress;
  const wrongChain = Boolean(activeAddress && chainId != null && chainId !== BASE_CHAIN_ID);

  const connectAndLink = useCallback(async () => {
    if (disabled || linking || !enabled) {
      return;
    }
    const linked = await linkPrivyWallet();
    if (linked) {
      await onLinked?.();
    }
  }, [disabled, enabled, linkPrivyWallet, linking, onLinked]);

  if (!enabled) {
    return <p className={`text-xs text-terminal-warning ${className}`}>{c.paymentUnavailable}</p>;
  }

  if (!ready) {
    return (
      <div className={`flex items-center justify-center gap-2 py-2 text-sm text-slate-600 ${className}`}>
        <Loader2 size={16} className="animate-spin" aria-hidden />
        {w.connecting}
      </div>
    );
  }

  if (wrongChain) {
    return (
      <p className={`text-xs text-terminal-warning ${className}`}>
        Cambiá a Base en tu Privy Wallet para pagar USDC.
      </p>
    );
  }

  if (authenticated && activeAddress) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="font-mono text-[11px] font-medium text-emerald-700">
          {formatMessage(c.walletConnectPayingFromShort, {
            address: `${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}`
          })}
        </p>
        <p className="text-[10px] text-slate-600">
          Privy Wallet en Base — gas pagado por vos en USDC (~$0,01–0,03).
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void connectAndLink()}
        disabled={disabled || linking}
        className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-600/40 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {linking ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
        {linking ? w.connecting : 'Crear / conectar Privy Wallet'}
      </button>
      <p className="max-w-xs text-center text-[11px] text-slate-600">
        Wallet embebida en Base — ideal para móvil y Morpho. Pagás USDC directo al treasury.
      </p>
      {linkError ? <p className="text-xs text-terminal-warning">{linkError}</p> : null}
    </div>
  );
}
