'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { InvestorPageHeader } from '../dashboard/investor/InvestorPageHeader';
import { InvestorWalletLinker } from './InvestorWalletLinker';

export function InvestorCollectionWalletView() {
  const t = useTranslation();
  const w = t.collectionWallet;
  const c = t.checkout;
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/dashboard';
  const pendingPreference = searchParams.get('preference');
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link
        href={returnTo}
        className="inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
      >
        <ArrowLeft size={16} />
        {w.back}
      </Link>

      <InvestorPageHeader eyebrow={t.nav.dashboard} title={w.title} subtitle={w.subtitle} />

      <article className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card p-6 md:p-8">
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
      </article>

      <p className="text-center text-xs text-terminal-muted">{c.walletSectionHint}</p>
    </section>
  );
}
