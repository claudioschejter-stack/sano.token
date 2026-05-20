'use client';

import Image from 'next/image';
import { MapPin, ShieldAlert, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useCtaVariant } from '../../hooks/useCtaVariant';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

export type PropertyCardProps = {
  id: string;
  title: string;
  location: string;
  imageUrl: string;
  mapEmbedUrl?: string;
  apyPercent: number;
  pricePerTokenUsd: number;
  availableTokens: number;
  totalTokens: number;
  soldPercent: number;
  jurisdiction?: string | null;
  fiscalRegime?: string;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

export function PropertyCard({
  id,
  title,
  location,
  imageUrl,
  mapEmbedUrl,
  apyPercent,
  pricePerTokenUsd,
  availableTokens,
  totalTokens,
  soldPercent,
  jurisdiction,
  fiscalRegime,
  kycStatus,
  onBuy,
  onStartKyc
}: PropertyCardProps) {
  const t = useTranslation();
  const { label: ctaLabel } = useCtaVariant();
  const { formatFromUsd, formatPercent } = useLocalCurrency();

  const isVerified = kycStatus === 'APPROVED';
  const estimatedAnnualYieldUsd = pricePerTokenUsd * (apyPercent / 100);
  const isScarce = totalTokens > 0 && availableTokens / totalTokens <= 0.2;

  const handlePrimaryAction = () => {
    if (isVerified) {
      onBuy?.(id);
      return;
    }

    onStartKyc?.(id);
  };

  return (
    <article className="group overflow-hidden rounded-xl border border-terminal-border bg-terminal-card shadow-[0_0_0_1px_rgba(31,41,55,0.5)] transition-all duration-300 hover:border-terminal-primary/50 hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]">
      <div className="relative h-56 w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-terminal-bg via-terminal-bg/20 to-transparent" />
        {isScarce ? (
          <span className="absolute right-3 top-3 rounded-full border border-terminal-accent/40 bg-terminal-bg/90 px-3 py-1 text-xs font-semibold text-terminal-accent">
            {t.propertyCard.limitedAvailability}
          </span>
        ) : null}
        <p className="absolute bottom-4 left-4 right-4 text-lg font-semibold text-terminal-text">{title}</p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-terminal-muted">
            <span>{t.propertyCard.placementProgress}</span>
            <span className="font-mono text-terminal-text">{soldPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-terminal-bg">
            <div
              className="h-full rounded-full bg-gradient-to-r from-terminal-primary to-terminal-success transition-all duration-500"
              style={{ width: `${soldPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-terminal-muted">
            {availableTokens.toLocaleString()} / {totalTokens.toLocaleString()} {t.marketplace.tokensAvailable}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-terminal-muted">
          <MapPin size={16} className="shrink-0 text-terminal-primary" />
          <span className="line-clamp-1">{location}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
            <p className="text-xs text-terminal-muted">{t.common.projectedApy}</p>
            <p className="mt-1 font-mono text-xl font-bold text-terminal-success">{formatPercent(apyPercent)}</p>
          </div>
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
            <p className="text-xs text-terminal-muted">{t.propertyCard.tokenPrice}</p>
            <p className="mt-1 font-mono text-xl font-bold text-terminal-text">{formatFromUsd(pricePerTokenUsd)}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-terminal-success/20 bg-terminal-success/5 p-3">
          <TrendingUp size={16} className="mt-0.5 shrink-0 text-terminal-success" />
          <div>
            <p className="text-xs text-terminal-muted">{t.propertyCard.estimatedAnnualIncome}</p>
            <p className="font-mono text-sm font-semibold text-terminal-success">
              {formatFromUsd(estimatedAnnualYieldUsd)} / {t.propertyCard.perToken}
            </p>
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs text-terminal-muted">
          <Zap size={14} className="text-terminal-accent" />
          {t.propertyCard.instantLiquidity}
        </p>

        {(jurisdiction || fiscalRegime) && (
          <div className="flex flex-wrap gap-2">
            {jurisdiction ? (
              <span className="rounded-md border border-terminal-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-terminal-muted">
                {jurisdiction}
              </span>
            ) : null}
            {fiscalRegime ? (
              <span className="rounded-md border border-terminal-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-terminal-muted">
                {fiscalRegime.replace('_', ' ')}
              </span>
            ) : null}
          </div>
        )}

        {mapEmbedUrl ? (
          <details className="overflow-hidden rounded-lg border border-terminal-border">
            <summary className="cursor-pointer px-3 py-2 text-xs text-terminal-muted hover:text-terminal-text">
              {t.propertyCard.viewMap}
            </summary>
            <iframe
              title={`${title} map`}
              src={mapEmbedUrl}
              className="h-32 w-full border-t border-terminal-border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </details>
        ) : null}

        <p className="text-xs text-terminal-muted">
          {isVerified ? t.propertyCard.readyForCheckout : t.propertyCard.kycRequired}
        </p>

        <button
          type="button"
          onClick={handlePrimaryAction}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${
            isVerified
              ? 'bg-terminal-primary text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-terminal-primary/25'
              : 'border border-terminal-warning/50 bg-terminal-bg text-terminal-warning hover:bg-terminal-warning/10'
          }`}
        >
          {isVerified ? (
            <>
              <Wallet size={18} />
              {ctaLabel}
            </>
          ) : (
            <>
              <ShieldAlert size={18} />
              {t.common.completeKyc}
            </>
          )}
        </button>
      </div>
    </article>
  );
}
