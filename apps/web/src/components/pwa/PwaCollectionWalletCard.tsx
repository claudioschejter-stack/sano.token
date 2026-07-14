'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { COLLECTION_WALLET_SECTION_ID } from '../../lib/navigation/collectionWalletPath';
import { InvestorWalletLinker } from '../wallet/InvestorWalletLinker';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../lib/pwa/mpTheme';

const LEGACY_WALLET_SECTION_HASH = 'wallet-cobro';

export function PwaCollectionWalletCard() {
  const t = useTranslation();
  const h = t.pwaHome;
  const cw = t.collectionWallet;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { checklist } = useAccountStatus();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const walletLinked = Boolean(checklist?.walletLinked);
  const returnTo = searchParams.get('returnTo') ?? '/dashboard/settings/security';
  const pendingPreference = searchParams.get('preference') === 'USDC' ? 'USDC' : undefined;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash.replace('#', '');
    const shouldFocus =
      hash === COLLECTION_WALLET_SECTION_ID ||
      hash === LEGACY_WALLET_SECTION_HASH ||
      searchParams.has('returnTo') ||
      searchParams.has('preference');

    if (shouldFocus) {
      setExpanded(true);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!walletLinked) {
      setExpanded(true);
    }
  }, [walletLinked]);

  return (
    <div
      id={COLLECTION_WALLET_SECTION_ID}
      ref={sectionRef}
      className="scroll-mt-24 px-4"
    >
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex items-start gap-3 p-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
          >
            <Wallet size={22} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">{h.collectionWalletTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {walletLinked ? h.collectionWalletLinkedHint : h.collectionWalletConnectHint}
            </p>
            {walletLinked && checklist?.walletAddress ? (
              <p className="mt-2 font-mono text-xs font-semibold text-slate-700">
                {checklist.walletAddress.slice(0, 6)}…{checklist.walletAddress.slice(-4)}
              </p>
            ) : null}
          </div>
          {walletLinked && !expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
            >
              {h.collectionWalletManage}
            </button>
          ) : null}
        </div>

        {!walletLinked ? (
          <p className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            {h.collectionWalletWithdrawNote}{' '}
            <Link href="/marketplace/carrito?mode=deposit" className="font-semibold underline">
              {h.depositAction}
            </Link>
          </p>
        ) : null}

        {(expanded || !walletLinked) && (
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="mb-3 text-xs text-slate-500">{cw.subtitle}</p>
            <InvestorWalletLinker
              variant="dashboard"
              allowReplace
              onError={(message) => setError(message ?? null)}
              onLinked={async () => {
                if (pendingPreference === 'USDC') {
                  await fetch('/api/investor/rent-payout-preference', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ preference: 'USDC' })
                  });
                }

                setExpanded(false);
                setError(null);

                const targetPath = returnTo.split('#')[0];
                if (targetPath === '/dashboard' && pathname === '/dashboard') {
                  return;
                }
                if (targetPath === pathname && !returnTo.includes('#')) {
                  return;
                }

                router.push(returnTo);
              }}
            />
            {walletLinked ? (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mt-3 w-full rounded-xl py-2.5 text-xs font-semibold text-slate-500"
              >
                {h.collectionWalletCollapse}
              </button>
            ) : null}
            {error ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
