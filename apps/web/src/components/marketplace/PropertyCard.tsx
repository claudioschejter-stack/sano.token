'use client';

import Image from 'next/image';
import { MapPin, ShieldAlert, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useState } from 'react';
import { useCtaVariant } from '../../hooks/useCtaVariant';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import type { LaunchContracts, LaunchMediaItem } from '../../lib/admin/launchTypes';
import { LaunchContractsPanel } from './LaunchContractsPanel';

export type PropertyCardProps = {
  id: string;
  title: string;
  description?: string;
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
  tokenInstrumentType?: 'DEBT' | 'EQUITY';
  maturityDate?: string | null;
  equitySharePercent?: number | null;
  tokenSymbol?: string | null;
  mediaGallery?: LaunchMediaItem[];
  contracts?: LaunchContracts;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

export function PropertyCard({
  id,
  title,
  description,
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
  tokenInstrumentType = 'EQUITY',
  maturityDate,
  equitySharePercent,
  tokenSymbol,
  mediaGallery = [],
  contracts = {},
  kycStatus,
  onBuy,
  onStartKyc
}: PropertyCardProps) {
  const t = useTranslation();
  const { label: ctaLabel } = useCtaVariant();
  const { formatFromUsd, formatPercent } = useLocalCurrency();
  const [heroIndex, setHeroIndex] = useState(0);

  const images = mediaGallery.filter((item) => item.type === 'image');
  const reels = mediaGallery.filter((item) => item.type === 'reel');
  const heroUrl = images[heroIndex]?.url ?? imageUrl;
  const isExternalMedia = heroUrl.startsWith('http');

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

  const isDebt = tokenInstrumentType === 'DEBT';
  const yieldLabel = isDebt ? t.propertyCard.fixedCoupon : t.common.projectedApy;
  const incomeLabel = isDebt ? t.propertyCard.fixedAnnualPayment : t.propertyCard.estimatedAnnualIncome;

  return (
    <article className="group overflow-hidden rounded-xl border border-terminal-border bg-terminal-card shadow-[0_0_0_1px_rgba(31,41,55,0.5)] transition-all duration-300 hover:border-terminal-primary/50 hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]">
      <div className="relative h-48 w-full overflow-hidden sm:h-56">
        <Image
          src={heroUrl}
          alt={title}
          fill
          unoptimized={isExternalMedia}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        {images.length > 1 ? (
          <div className="absolute bottom-3 right-3 flex gap-1">
            {images.map((item, index) => (
              <button
                key={item.url}
                type="button"
                onClick={() => setHeroIndex(index)}
                className={`h-2 w-2 rounded-full ${index === heroIndex ? 'bg-terminal-primary' : 'bg-white/60'}`}
                aria-label={`Image ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-terminal-bg via-terminal-bg/20 to-transparent" />
        {isScarce ? (
          <span className="absolute right-3 top-3 rounded-full border border-terminal-accent/40 bg-terminal-bg/90 px-3 py-1 text-xs font-semibold text-terminal-accent">
            {t.propertyCard.limitedAvailability}
          </span>
        ) : null}
        <span
          className={`absolute right-3 ${isScarce ? 'top-12' : 'top-3'} rounded-full border px-3 py-1 text-xs font-semibold ${
            isDebt ?
              'border-terminal-warning/40 bg-terminal-bg/90 text-terminal-warning'
            : 'border-terminal-primary/40 bg-terminal-bg/90 text-terminal-primary'
          }`}
        >
          {isDebt ? t.propertyCard.instrumentDebt : t.propertyCard.instrumentEquity}
        </span>
        <div className="absolute bottom-3 left-3 rounded-lg border border-terminal-border bg-terminal-bg/90 p-2.5 backdrop-blur-sm sm:bottom-4 sm:left-4 sm:p-3">
          <p className="text-[10px] text-terminal-muted sm:text-xs">{yieldLabel}</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-terminal-success sm:mt-1 sm:text-xl">
            {formatPercent(apyPercent, { minimum: 2, maximum: 2 })}
          </p>
        </div>
        <p className="absolute bottom-20 left-3 right-3 text-base font-semibold leading-snug text-terminal-text sm:bottom-24 sm:left-4 sm:right-4 sm:text-lg">
          {title}
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
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

        {description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-terminal-muted">{description}</p>
        ) : null}

        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
          <p className="text-xs text-terminal-muted">{t.propertyCard.tokenPrice}</p>
          <p className="mt-1 font-mono text-xl font-bold text-terminal-text">{formatFromUsd(pricePerTokenUsd)}</p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-terminal-success/20 bg-terminal-success/5 p-3">
          <TrendingUp size={16} className="mt-0.5 shrink-0 text-terminal-success" />
          <div>
            <p className="text-xs text-terminal-muted">{incomeLabel}</p>
            <p className="font-mono text-sm font-semibold text-terminal-success">
              {formatFromUsd(estimatedAnnualYieldUsd)} / {t.propertyCard.perToken}
            </p>
            {isDebt && maturityDate ? (
              <p className="mt-1 text-[10px] text-terminal-muted">
                {t.propertyCard.maturity}: {new Date(maturityDate).toLocaleDateString()}
              </p>
            ) : null}
            {!isDebt && equitySharePercent != null ? (
              <p className="mt-1 text-[10px] text-terminal-muted">
                {t.propertyCard.equityParticipation}: {equitySharePercent}%
              </p>
            ) : null}
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

        {reels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {reels.map((reel) => (
              <a
                key={reel.url}
                href={reel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-terminal-primary underline"
              >
                {t.propertyCard.viewReel}
              </a>
            ))}
          </div>
        ) : null}

        <LaunchContractsPanel contracts={contracts} tokenSymbol={tokenSymbol} />

        <p className="text-xs text-terminal-muted">
          {isVerified ? t.propertyCard.readyForCheckout : t.propertyCard.kycRequired}
        </p>

        <button
          type="button"
          onClick={handlePrimaryAction}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold transition-all duration-200 sm:text-sm ${
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
