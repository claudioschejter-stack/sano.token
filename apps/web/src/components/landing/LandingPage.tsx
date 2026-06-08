'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Building2,
  CircleDollarSign,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Wallet
} from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

const LANDING_HERO_IMAGE = '/images/landing-hero-energy-yields.webp';
import { LandingHeader } from './LandingHeader';
import { HeroSubtitle } from './HeroSubtitle';
import { FeaturedPropertiesSection } from './FeaturedPropertiesSection';
import { MacroInvestmentThesis } from './MacroInvestmentThesis';
import { MarketplaceCtaLink } from './MarketplaceCtaLink';
import { VacaMuertaOperators } from './VacaMuertaOperators';
import type { MarketplaceFeed } from '../../types/marketplace';

type LandingPageProps = {
  initialFeed: MarketplaceFeed;
};

function HeroActions({ primary, secondary, trustLine }: { primary: string; secondary: string; trustLine: string }) {
  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:gap-4">
        <MarketplaceCtaLink>{primary}</MarketplaceCtaLink>
        <a
          href="#how-it-works"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 md:w-auto md:text-sm"
        >
          {secondary}
        </a>
      </div>
      <p className="mt-4 text-sm text-slate-400">{trustLine}</p>
    </div>
  );
}

export function LandingPage({ initialFeed }: LandingPageProps) {
  const t = useTranslation();
  const l = t.landing;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <LandingHeader showLanguageSelector />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#0A0E17] via-[#111827] to-[#1e3a5f] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #3B82F6 0%, transparent 40%), radial-gradient(circle at 80% 60%, #F97316 0%, transparent 35%)'
          }}
        />
        <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 pb-12 pt-[0.5cm] sm:gap-10 sm:px-6 sm:pb-14 lg:grid-cols-2 lg:items-start lg:gap-10 lg:pb-16 xl:gap-12">
          <div className="flex w-full flex-col justify-start lg:max-w-xl lg:pr-2 xl:max-w-[34rem]">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 sm:text-sm">
              {l.hero.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:mt-3 md:text-4xl lg:text-5xl xl:text-6xl">
              {l.hero.title.split('\n').map((line) => (
                <span key={line} className="block last:text-blue-200">
                  {line}
                </span>
              ))}
            </h1>
            <HeroSubtitle hero={l.hero} />
            <div className="mt-8 lg:hidden">
              <HeroActions
                primary={l.hero.ctaPrimary}
                secondary={l.hero.ctaSecondary}
                trustLine={l.hero.trustLine}
              />
            </div>
          </div>

          <div className="relative hidden lg:flex lg:flex-col lg:justify-start">
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 ring-white/10">
                <Image
                  src={LANDING_HERO_IMAGE}
                  alt={l.hero.heroImageAlt}
                  width={1400}
                  height={933}
                  className="h-[min(360px,42svh)] w-full object-cover object-center xl:h-[380px]"
                  priority
                  sizes="(min-width: 1024px) 50vw, 0px"
                />
              </div>
              <div className="absolute bottom-0 right-0 z-10 max-w-[18rem] translate-x-[5mm] translate-y-[2mm] rounded-xl border border-white/20 bg-[#111827]/95 p-3 shadow-xl backdrop-blur sm:p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">{l.hero.heroBadgeTitle}</p>
                <p className="mt-1 text-sm font-semibold text-blue-200">{l.hero.heroBadgeSubtitle}</p>
                <p className="mt-1 text-sm text-slate-300">{l.hero.heroBadgeDetail}</p>
              </div>
            </div>
            <div className="mt-4">
              <HeroActions
                primary={l.hero.ctaPrimary}
                secondary={l.hero.ctaSecondary}
                trustLine={l.hero.trustLine}
              />
            </div>
          </div>
        </div>
      </section>

      <VacaMuertaOperators />

      <MacroInvestmentThesis />

      <section
        id="how-it-works"
        className="how-it-works-section mx-auto w-full max-w-7xl overflow-x-hidden px-3 sm:px-4 sm:py-16 md:px-6 md:py-20"
      >
        <div className="how-it-works-intro mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-bold text-slate-900 sm:text-3xl md:text-4xl">
            {l.howItWorks.title}
          </h2>
          <p className="text-pretty text-slate-600 sm:mt-4 sm:text-base md:text-lg">
            {l.howItWorks.subtitle}
          </p>
        </div>
        <div className="how-it-works-grid mt-10 grid min-w-0 grid-cols-1 gap-6 md:mt-14 md:grid-cols-2 md:gap-8 xl:grid-cols-4">
          {[
            { icon: UserCheck, title: l.howItWorks.step1Title, desc: l.howItWorks.step1Desc },
            { icon: Building2, title: l.howItWorks.step2Title, desc: l.howItWorks.step2Desc },
            { icon: Wallet, title: l.howItWorks.step3Title, desc: l.howItWorks.step3Desc },
            { icon: ArrowLeftRight, title: l.howItWorks.step4Title, desc: l.howItWorks.step4Desc }
          ].map((step, index) => (
            <article
              key={step.title}
              className="how-it-works-card flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md md:p-7"
            >
              <div className="how-it-works-card-header grid grid-cols-[1.75rem_3rem_minmax(0,1fr)] items-center gap-x-3">
                <span className="how-it-works-step-num flex items-center text-sm font-semibold tracking-wide text-blue-600">
                  0{index + 1}
                </span>
                <div className="how-it-works-card-icon flex items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <step.icon size={24} aria-hidden />
                </div>
                <h3 className="how-it-works-card-title flex items-center font-bold leading-tight text-slate-900 sm:text-sm md:text-base">
                  <span className="line-clamp-2">{step.title}</span>
                </h3>
              </div>
              <p className="how-it-works-card-desc mt-4 w-full text-slate-600 sm:text-sm sm:leading-relaxed">
                {step.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      <FeaturedPropertiesSection initialFeed={initialFeed} />

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900 md:text-4xl">{l.benefits.title}</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-12 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {[
            { icon: CircleDollarSign, title: l.benefits.incomeTitle, desc: l.benefits.incomeDesc },
            { icon: TrendingUp, title: l.benefits.liquidityTitle, desc: l.benefits.liquidityDesc },
            { icon: ShieldCheck, title: l.benefits.complianceTitle, desc: l.benefits.complianceDesc }
          ].map((item) => (
            <article key={item.title} className="flex flex-col rounded-2xl border border-slate-200 p-6 md:p-8">
              <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3">
                <div className="flex h-8 items-center text-blue-600">
                  <item.icon size={32} aria-hidden="true" />
                </div>
                <h3 className="flex h-8 items-center text-xl font-bold leading-tight text-slate-900">
                  {item.title}
                </h3>
              </div>
              <p className="mt-4 w-full text-sm leading-relaxed text-slate-600">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-blue-800 py-12 text-white md:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold md:text-4xl">{l.cta.title}</h2>
          <p className="mt-4 text-base text-blue-100 md:text-lg">{l.cta.subtitle}</p>
          <MarketplaceCtaLink className="mt-8">{l.cta.button}</MarketplaceCtaLink>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-900 px-4 pb-10 text-slate-400 md:px-6 md:pb-12">
        <div className="mx-auto w-full max-w-7xl">
          <nav
            className="mt-8 flex flex-col gap-2 text-sm text-slate-300 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-5"
            aria-label={l.footer.navAria}
          >
            <Link href="/acceso?returnTo=/marketplace" className="hover:text-white">
              {l.nav.marketplace}
            </Link>
            <Link href="/acceso" className="hover:text-white">
              {l.nav.platformAccess}
            </Link>
            <Link href="/privacidad" className="hover:text-white">
              {l.footer.privacy}
            </Link>
            <Link href="/terminos" className="hover:text-white">
              {l.footer.terms}
            </Link>
            <Link href="/contacto" className="hover:text-white">
              {l.footer.contact}
            </Link>
          </nav>

          <div className="mt-8 w-full md:mt-10">
            <p className="text-lg font-bold text-white md:text-xl">Sanova Global</p>
            <p className="mt-2 text-sm leading-relaxed">{l.footer.tagline}</p>
          </div>

          <p className="mt-8 text-xs leading-relaxed md:mt-10">{l.footer.disclaimer}</p>
          <p className="mt-4 text-xs">{l.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}

