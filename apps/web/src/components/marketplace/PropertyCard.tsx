'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import type { LaunchContracts, LaunchMediaItem } from '../../lib/admin/launchTypes';
import type { SystemRole } from '../../lib/auth/roles';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { LaunchContractsPanel } from './LaunchContractsPanel';
import { PropertyCardActions } from './PropertyCardActions';

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
  role?: SystemRole;
  investorHolding?: SecondaryMarketHolding | null;
  readyToBorrow?: boolean;
  purchaseEnabled?: boolean;
  staffPreviewHint?: string;
  variant?: 'terminal' | 'light';
  className?: string;
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

type MediaSlide = {
  type: 'image' | 'reel';
  url: string;
  caption?: string;
};

const GALLERY_INTERVAL_MS = 5000;

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
  tokenInstrumentType = 'EQUITY',
  maturityDate,
  tokenSymbol,
  mediaGallery = [],
  contracts = {},
  kycStatus,
  role,
  investorHolding,
  readyToBorrow = false,
  purchaseEnabled = true,
  staffPreviewHint,
  variant = 'terminal',
  className = '',
  onBuy,
  onStartKyc
}: PropertyCardProps) {
  const t = useTranslation();
  const { formatUsdPlain, formatPercent } = useLocalCurrency();
  const [heroIndex, setHeroIndex] = useState(0);
  const isLight = variant === 'light';

  const slides = useMemo<MediaSlide[]>(() => {
    const reels = mediaGallery.filter((item) => item.type === 'reel');
    const images = mediaGallery.filter((item) => item.type === 'image');
    const ordered = [...reels, ...images];

    if (ordered.length > 0) {
      return ordered;
    }

    if (imageUrl) {
      return [{ type: 'image', url: imageUrl }];
    }

    return [];
  }, [mediaGallery, imageUrl]);

  useEffect(() => {
    setHeroIndex(0);
  }, [slides.length, id]);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % slides.length);
    }, GALLERY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const currentSlide = slides[heroIndex] ?? slides[0];
  const heroUrl = currentSlide?.url ?? imageUrl;
  const isExternalMedia = heroUrl.startsWith('http');

  const estimatedAnnualYieldUsd = pricePerTokenUsd * (apyPercent / 100);
  const isSoldOut = availableTokens <= 0;
  const isScarce = !isSoldOut && totalTokens > 0 && availableTokens / totalTokens <= 0.2;

  const isDebt = tokenInstrumentType === 'DEBT';
  const yieldLabel = isDebt ? t.propertyCard.fixedCoupon : t.common.projectedApy;
  const incomeLabel = isDebt ? t.propertyCard.fixedAnnualPayment : t.propertyCard.estimatedAnnualIncome;

  const mutedText = isLight ? 'text-slate-500' : 'text-terminal-muted';
  const bodyText = isLight ? 'text-slate-900' : 'text-terminal-text';
  const panelBg = isLight ? 'border-slate-200 bg-slate-50' : 'border-terminal-border bg-terminal-bg';
  const cardShell = isLight
    ? 'border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-lg'
    : 'border-terminal-border bg-terminal-card shadow-[0_0_0_1px_rgba(31,41,55,0.5)] hover:border-terminal-primary/50 hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]';

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-xl ${cardShell} transition-all duration-300 ${className}`.trim()}
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-56">
        {currentSlide?.type === 'reel' ? (
          <video
            key={heroUrl}
            src={heroUrl}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Image
            key={heroUrl}
            src={heroUrl}
            alt={title}
            fill
            unoptimized={isExternalMedia}
            className="object-cover transition-opacity duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        )}
        {slides.length > 1 ? (
          <div className="absolute bottom-3 right-3 flex gap-1">
            {slides.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                type="button"
                onClick={() => setHeroIndex(index)}
                className={`h-2 w-2 rounded-full ${
                  index === heroIndex ? 'bg-terminal-primary' : 'bg-white/60'
                }`}
                aria-label={`${item.type} ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
        <div
          className={`absolute inset-0 bg-gradient-to-t ${
            isLight ? 'from-slate-900/80 via-slate-900/20' : 'from-terminal-bg via-terminal-bg/20'
          } to-transparent`}
        />
        {isScarce ? (
          <span className="absolute right-3 top-3 rounded-full border border-terminal-accent/40 bg-terminal-bg/90 px-3 py-1 text-xs font-semibold text-terminal-accent">
            {t.propertyCard.limitedAvailability}
          </span>
        ) : null}
        <span
          className={`absolute right-3 ${isScarce ? 'top-12' : 'top-3'} rounded-full border px-3 py-1 text-xs font-semibold ${
            isDebt
              ? 'border-terminal-warning/40 bg-terminal-bg/90 text-terminal-warning'
              : 'border-terminal-primary/40 bg-terminal-bg/90 text-terminal-primary'
          }`}
        >
          {isDebt ? t.propertyCard.instrumentDebt : t.propertyCard.instrumentEquity}
        </span>
        <div className="absolute bottom-3 left-3 rounded-lg border border-terminal-border bg-terminal-bg/90 px-3 py-2 text-center backdrop-blur-sm sm:bottom-4 sm:left-4">
          <p className="text-[10px] text-terminal-muted sm:text-xs">{yieldLabel}</p>
          <p className="font-mono text-lg font-bold leading-tight text-terminal-success sm:text-xl">
            {formatPercent(apyPercent, { minimum: 2, maximum: 2 })}
          </p>
        </div>
        <p className="absolute bottom-20 left-3 right-3 line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-white sm:bottom-24 sm:left-4 sm:right-4 sm:text-lg">
          {title}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="shrink-0 space-y-4">
          <p className={`min-h-5 truncate text-xs ${mutedText}`}>{location || '\u00A0'}</p>

          <div>
            <div className={`mb-1 flex items-center justify-between text-xs ${mutedText}`}>
              <span>{t.propertyCard.placementProgress}</span>
              <span className={`font-mono ${bodyText}`}>{soldPercent}%</span>
            </div>
            <div className={`h-1.5 overflow-hidden rounded-full ${isLight ? 'bg-slate-100' : 'bg-terminal-bg'}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-terminal-primary to-terminal-success transition-all duration-500"
                style={{ width: `${soldPercent}%` }}
              />
            </div>
            <p className={`mt-1 min-h-4 text-xs ${mutedText}`}>
              {availableTokens.toLocaleString()} / {totalTokens.toLocaleString()} {t.marketplace.tokensAvailable}
            </p>
          </div>

          <p className={`line-clamp-3 min-h-[4.5rem] text-sm leading-relaxed ${mutedText}`}>
            {description || '\u00A0'}
          </p>

          <div className={`flex min-h-[3.25rem] items-center justify-between gap-3 rounded-lg border px-3 py-2 ${panelBg}`}>
            <p className={`text-xs ${mutedText}`}>{t.propertyCard.tokenPrice}</p>
            <p className={`font-mono text-xl font-bold leading-none ${bodyText}`}>
              USD {formatUsdPlain(pricePerTokenUsd)}
            </p>
          </div>

          <div
            className={`min-h-[3.75rem] rounded-lg border px-3 py-2 ${
              isLight ? 'border-emerald-200 bg-emerald-50' : 'border-terminal-success/20 bg-terminal-success/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className={`text-xs ${mutedText}`}>{incomeLabel}</p>
              <p className="font-mono text-sm font-semibold leading-none text-terminal-success">
                USD {formatUsdPlain(estimatedAnnualYieldUsd, { min: 2, max: 2 })} / {t.propertyCard.perToken}
              </p>
            </div>
            <p className={`mt-1 min-h-[14px] text-[10px] ${mutedText}`}>
              {isDebt && maturityDate
                ? `${t.propertyCard.maturity}: ${new Date(maturityDate).toLocaleDateString()}`
                : '\u00A0'}
            </p>
          </div>

          <div className="flex min-h-7 flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide ${panelBg} ${mutedText}`}
            >
              {t.propertyCard.tokenSymbolLabel}
            </span>
            {tokenSymbol ? (
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${panelBg} ${bodyText}`}
              >
                {tokenSymbol}
              </span>
            ) : null}
            {!isSoldOut ? (
              <LaunchContractsPanel contracts={contracts} tokenSymbol={tokenSymbol} variant="badge" />
            ) : null}
          </div>

          {!isSoldOut && mapEmbedUrl ? (
            <div className="min-h-9">
              <details className={`overflow-hidden rounded-lg border ${isLight ? 'border-slate-200' : 'border-terminal-border'}`}>
                <summary className={`cursor-pointer px-3 py-2 text-xs ${mutedText} hover:opacity-80`}>
                  {t.propertyCard.viewMap}
                </summary>
                <iframe
                  title={`${title} map`}
                  src={mapEmbedUrl}
                  className={`h-32 w-full border-t ${isLight ? 'border-slate-200' : 'border-terminal-border'}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </details>
            </div>
          ) : null}
        </div>

        {purchaseEnabled || staffPreviewHint ? (
          <div className="mt-auto shrink-0 pt-4">
            <PropertyCardActions
              projectId={id}
              availableTokens={availableTokens}
              kycStatus={kycStatus}
              role={role}
              investorHolding={investorHolding}
              readyToBorrow={readyToBorrow}
              purchaseEnabled={purchaseEnabled}
              staffPreviewHint={staffPreviewHint}
              mutedTextClass={mutedText}
              onBuy={onBuy}
              onStartKyc={onStartKyc}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
