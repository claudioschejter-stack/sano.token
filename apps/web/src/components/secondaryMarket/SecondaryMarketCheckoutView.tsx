'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { resolveInvestorApiErrorMessage } from '../../lib/i18n/resolveInvestorApiError';

type CheckoutMode = 'buy' | 'platform-buyback';

export function SecondaryMarketCheckoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslation();
  const sm = t.secondaryMarket;
  const { intlLocale } = useLocale();
  const { formatUsd } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { checklist, loading: accountLoading } = useAccountStatus();

  const listingId = searchParams.get('listingId');
  const projectId = searchParams.get('projectId');
  const mode: CheckoutMode | null = listingId
    ? 'buy'
    : projectId
      ? 'platform-buyback'
      : null;
  const tokenCount = Math.max(1, Number.parseInt(searchParams.get('tokenCount') ?? '1', 10) || 1);

  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    projectTitle: string;
    tokenSymbol: string;
    tokenCount: number;
    pricePerTokenUsd: number;
    totalUsd: number;
    sideLabel: string;
  } | null>(null);
  const executedRef = useRef(false);

  const kycApproved = checklist?.kycApproved ?? false;

  useEffect(() => {
    if (!mode || accountLoading || !kycApproved || executedRef.current) {
      return;
    }

    executedRef.current = true;
    setStatus('running');
    setError(null);

    void (async () => {
      try {
        if (mode === 'buy' && listingId) {
          const quoteResponse = await fetch(`/api/secondary-market/listings/${listingId}/quote`, {
            cache: 'no-store'
          });
          const quoteData = (await quoteResponse.json()) as {
            quote?: {
              projectTitle: string;
              tokenSymbol: string;
              tokenCount: number;
              pricePerTokenUsd: number;
              totalUsd: number;
            };
            error?: string;
          };

          if (!quoteResponse.ok || !quoteData.quote) {
            throw new Error(quoteData.error ?? 'QUOTE_FAILED');
          }

          setSummary({
            projectTitle: quoteData.quote.projectTitle,
            tokenSymbol: quoteData.quote.tokenSymbol,
            tokenCount: quoteData.quote.tokenCount,
            pricePerTokenUsd: quoteData.quote.pricePerTokenUsd,
            totalUsd: quoteData.quote.totalUsd,
            sideLabel: sm.checkoutBuySide
          });

          const response = await fetch(`/api/secondary-market/listings/${listingId}`, {
            method: 'POST'
          });
          const data = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(data.error ?? 'BUY_FAILED');
          }
        } else if (mode === 'platform-buyback' && projectId) {
          const quoteResponse = await fetch(
            `/api/secondary-market/platform-buyback/quote?projectId=${encodeURIComponent(projectId)}&tokenCount=${tokenCount}`,
            { cache: 'no-store' }
          );
          const quoteData = (await quoteResponse.json()) as {
            quote?: {
              projectTitle: string;
              tokenSymbol: string;
              tokenCount: number;
              pricePerTokenUsd: number;
              totalUsd: number;
            };
            error?: string;
          };

          if (!quoteResponse.ok || !quoteData.quote) {
            throw new Error(quoteData.error ?? 'QUOTE_FAILED');
          }

          setSummary({
            projectTitle: quoteData.quote.projectTitle,
            tokenSymbol: quoteData.quote.tokenSymbol,
            tokenCount: quoteData.quote.tokenCount,
            pricePerTokenUsd: quoteData.quote.pricePerTokenUsd,
            totalUsd: quoteData.quote.totalUsd,
            sideLabel: sm.checkoutSellSide
          });

          const response = await fetch('/api/secondary-market/platform-buyback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, tokenCount })
          });
          const data = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(data.error ?? 'BUYBACK_FAILED');
          }
        } else {
          throw new Error('INVALID_CHECKOUT');
        }

        setStatus('success');
        window.setTimeout(() => {
          router.replace('/mercado-secundario');
          router.refresh();
        }, 1200);
      } catch (checkoutError) {
        setStatus('error');
        const code = checkoutError instanceof Error ? checkoutError.message : '';
        setError(
          resolveInvestorApiErrorMessage(code, t) ||
            (checkoutError instanceof Error ? checkoutError.message : sm.checkoutError)
        );
      }
    })();
  }, [
    accountLoading,
    kycApproved,
    listingId,
    mode,
    projectId,
    router,
    sm.checkoutBuySide,
    sm.checkoutError,
    sm.checkoutSellSide,
    tokenCount
  ]);

  return (
    <section className="mx-auto max-w-lg">
      <Link
        href="/mercado-secundario"
        className="mb-6 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
      >
        <ArrowLeft size={16} />
        {sm.checkoutBack}
      </Link>

      <article className="rounded-xl border border-terminal-border bg-terminal-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-terminal-primary">{sm.checkoutEyebrow}</p>
        <h1 className="mt-2 text-xl font-bold text-terminal-text">{sm.checkoutTitle}</h1>
        <p className="mt-1 text-sm text-terminal-muted">{sm.checkoutSubtitle}</p>

        {!kycApproved && !accountLoading ? (
          <p className="mt-4 text-sm text-terminal-warning">
            {sm.kycRequired}{' '}
            <Link href="/kyc?returnTo=/mercado-secundario/checkout" className="font-semibold underline">
              {sm.completeKyc}
            </Link>
          </p>
        ) : null}

        {summary ? (
          <dl className="mt-5 space-y-2 rounded-lg border border-terminal-border bg-terminal-bg p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-terminal-muted">{sm.colAsset}</dt>
              <dd className="text-right font-medium text-terminal-text">{summary.projectTitle}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-terminal-muted">{sm.checkoutSide}</dt>
              <dd className="text-right font-medium text-terminal-text">{summary.sideLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-terminal-muted">{sm.colTokens}</dt>
              <dd className="font-mono text-terminal-text">
                {summary.tokenCount.toLocaleString(intlLocale)} {summary.tokenSymbol}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-terminal-muted">{sm.colPrice}</dt>
              <dd className="font-mono text-terminal-text">{formatUsd(summary.pricePerTokenUsd)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-terminal-border pt-2">
              <dt className="font-semibold text-terminal-text">{sm.colTotal}</dt>
              <dd className="font-mono font-semibold text-terminal-primary">{formatUsd(summary.totalUsd)}</dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-5 flex items-center gap-2 text-sm">
          {status === 'running' ? <Loader2 size={16} className="animate-spin text-terminal-primary" /> : null}
          <span className="text-terminal-muted">
            {status === 'running'
              ? sm.checkoutRunning
              : status === 'success'
                ? sm.checkoutSuccess
                : status === 'error'
                  ? sm.checkoutFailed
                  : sm.checkoutPending}
          </span>
        </div>

        {error ? <p className="mt-3 text-sm text-terminal-warning">{error}</p> : null}
      </article>
    </section>
  );
}
