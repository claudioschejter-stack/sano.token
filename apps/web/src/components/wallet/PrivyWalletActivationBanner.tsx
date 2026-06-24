'use client';

/**
 * Non-blocking banner that prompts the user to authenticate with Privy once,
 * right after they land on the dashboard (not mid-payment).
 *
 * Once the user completes the Privy OTP, the banner auto-disappears and the
 * Privy session is persisted in the browser — no more interruptions at payment.
 *
 * The banner is only shown when:
 *   - User is authenticated with NextAuth
 *   - Privy is enabled and ready
 *   - Privy is NOT yet authenticated in this browser
 */

import { Loader2, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { usePrivyAutoLogin } from '../../hooks/usePrivyAutoLogin';
import { useTranslation } from '../../i18n/LocaleProvider';

export function PrivyWalletActivationBanner() {
  const { shouldPrompt, triggerLogin, isLoggingIn } = usePrivyAutoLogin();
  const [dismissed, setDismissed] = useState(false);
  const t = useTranslation();
  const w = t.walletActivation;

  if (!shouldPrompt || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Wallet size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{w.title}</p>
          <p className="mt-0.5 text-xs text-slate-600">{w.desc}</p>

          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 disabled:opacity-60"
            onClick={() => void triggerLogin()}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                {w.loading}
              </>
            ) : (
              w.cta
            )}
          </button>
        </div>

        <button
          type="button"
          aria-label={w.dismiss}
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
          onClick={() => setDismissed(true)}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
