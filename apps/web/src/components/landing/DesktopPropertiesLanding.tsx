'use client';

import { useTranslation } from '../../i18n/LocaleProvider';
import type { MarketplaceFeed } from '../../types/marketplace';
import { FeaturedPropertiesSection } from './FeaturedPropertiesSection';
import { MarketplaceCtaLink } from './MarketplaceCtaLink';

type DesktopPropertiesLandingProps = {
  initialFeed: MarketplaceFeed;
};

/**
 * Desktop landing for vacamuertatoken.com.ar "Propiedades":
 * brand + short pitch, then the property listing grid above the fold.
 * Marketing narrative sections remain below this block.
 */
export function DesktopPropertiesLanding({ initialFeed }: DesktopPropertiesLandingProps) {
  const t = useTranslation();
  const l = t.landing;

  return (
    <div className="hidden lg:block">
      <section
        id="properties"
        aria-labelledby="desktop-properties-heading"
        className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(135deg,#0b1220_0%,#12233a_45%,#1a3a5c_100%)] text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 20%, rgba(59,130,246,0.45) 0%, transparent 42%), radial-gradient(circle at 88% 70%, rgba(14,165,233,0.25) 0%, transparent 38%)'
          }}
        />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 xl:py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
            Sanova Global
          </p>
          <div className="max-w-3xl">
            <h1
              id="desktop-properties-heading"
              className="text-4xl font-bold tracking-tight text-white xl:text-5xl"
            >
              {l.nav.properties}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300 xl:text-lg">
              {l.featured.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MarketplaceCtaLink>{l.featured.viewAll}</MarketplaceCtaLink>
            <a
              href="#how-it-works"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {l.nav.howItWorks}
            </a>
          </div>
          <p className="text-sm text-slate-400">{l.hero.trustLine}</p>
        </div>
      </section>

      <FeaturedPropertiesSection initialFeed={initialFeed} variant="desktop-landing" />
    </div>
  );
}
