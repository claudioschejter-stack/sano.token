'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { InvestorSection } from '../dashboard/investor/InvestorSection';
import { COLLECTION_WALLET_SECTION_ID } from '../../lib/navigation/collectionWalletPath';
import { InvestorWalletLinker } from './InvestorWalletLinker';

const LEGACY_WALLET_SECTION_HASH = 'wallet-cobro';

type InvestorCollectionWalletPanelProps = {
  /** When set, redirects here after linking instead of reading ?returnTo from the URL. */
  returnTo?: string;
  preference?: 'USDC';
};

export function InvestorCollectionWalletPanel({
  returnTo: returnToProp,
  preference: preferenceProp
}: InvestorCollectionWalletPanelProps) {
  const t = useTranslation();
  const d = t.dashboard;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const returnTo = returnToProp ?? searchParams.get('returnTo') ?? '/dashboard';
  const pendingPreference = preferenceProp ?? (searchParams.get('preference') === 'USDC' ? 'USDC' : undefined);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash.replace('#', '');
    const shouldScroll =
      hash === COLLECTION_WALLET_SECTION_ID ||
      hash === LEGACY_WALLET_SECTION_HASH ||
      searchParams.has('returnTo') ||
      searchParams.has('preference');

    if (shouldScroll) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  return (
    <div id={COLLECTION_WALLET_SECTION_ID} ref={sectionRef} className="scroll-mt-20">
      <InvestorSection
        title={d.walletConnectionTitle}
        subtitle={d.walletConnectionIntro}
        bodyClassName="p-6 md:p-8"
      >
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
        {error ? (
          <p className="mt-4 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
            {error}
          </p>
        ) : null}
      </InvestorSection>
    </div>
  );
}
