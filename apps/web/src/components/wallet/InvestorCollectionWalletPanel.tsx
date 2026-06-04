'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { InvestorSection } from '../dashboard/investor/InvestorSection';
import { COLLECTION_WALLET_SECTION_ID } from '../../lib/navigation/collectionWalletPath';
import { InvestorWalletLinker } from './InvestorWalletLinker';

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
  const w = t.collectionWallet;
  const c = t.checkout;
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement>(null);
  const [error, setError] = useState<string | null>(null);

  const returnTo = returnToProp ?? searchParams.get('returnTo') ?? '/dashboard';
  const pendingPreference = preferenceProp ?? (searchParams.get('preference') === 'USDC' ? 'USDC' : undefined);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const shouldScroll =
      window.location.hash === `#${COLLECTION_WALLET_SECTION_ID}` ||
      searchParams.has('returnTo') ||
      searchParams.has('preference');

    if (shouldScroll) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  return (
    <div id={COLLECTION_WALLET_SECTION_ID} ref={sectionRef} className="scroll-mt-20">
      <InvestorSection title={w.title} subtitle={w.subtitle} bodyClassName="p-6 md:p-8">
      <InvestorWalletLinker
        variant="checkout"
        allowReplace
        onError={(message) => setError(message)}
        onLinked={async () => {
          if (pendingPreference === 'USDC') {
            await fetch('/api/investor/rent-payout-preference', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ preference: 'USDC' })
            });
          }

          router.push(returnTo);
        }}
      />
      {error ? (
        <p className="mt-4 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-center text-xs text-terminal-muted">{c.walletSectionHint}</p>
      </InvestorSection>
    </div>
  );
}
