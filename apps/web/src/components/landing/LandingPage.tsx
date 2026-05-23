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
import { MARKETPLACE_FALLBACK_LISTINGS } from '../../data/marketplaceFallback';
import { formatMessage } from '../../i18n';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LandingHeader } from './LandingHeader';
import { HeroSubtitle } from './HeroSubtitle';
import { MacroInvestmentThesis } from './MacroInvestmentThesis';
import { MarketplaceCtaLink } from './MarketplaceCtaLink';
import { TrustBadges } from './TrustBadges';
import { VacaMuertaOperators } from './VacaMuertaOperators';

export function LandingPage() {
  const t = useTranslation();
  const l = t.landing;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingHeader showLanguageSelector />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#0A0E17] via-[#111827] to-[#1e3a5f] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #3B82F6 0%, transparent 40%), radial-gradient(circle at 80% 60%, #F97316 0%, transparent 35%)'
          }}
        />
        <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:gap-12 sm:px-6 sm:py-16 md:py-20 lg:grid-cols-2 lg:items-stretch lg:gap-14 lg:py-28">
          <div className="flex w-full flex-col justify-center lg:max-w-xl lg:pr-2 xl:max-w-[34rem]">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300 sm:text-sm">
              {l.hero.eyebrow}
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-6xl">
              {l.hero.title.split('\n').map((line) => (
                <span key={line} className="block last:text-blue-200">
                  {line}
                </span>
              ))}
            </h1>
            <HeroSubtitle hero={l.hero} />
            <div className="mt-8 flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:gap-4">
              <MarketplaceCtaLink>{l.hero.ctaPrimary}</MarketplaceCtaLink>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 md:w-auto md:text-sm"
              >
                {l.hero.ctaSecondary}
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-400 sm:mt-8">{l.hero.trustLine}</p>
          </div>

          <div className="relative hidden lg:flex lg:flex-col lg:justify-center">
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 ring-white/10">
              <Image
                src={MARKETPLACE_FALLBACK_LISTINGS[0]!.imageUrl}
                alt={MARKETPLACE_FALLBACK_LISTINGS[0]!.title}
                width={640}
                height={480}
                className="h-[420px] w-full object-cover"
                priority
              />
              </div>
              <div className="absolute -bottom-5 -left-[calc(1.25rem+0.5cm)] rounded-xl border border-white/20 bg-[#111827]/95 p-4 shadow-xl backdrop-blur">
                <p className="text-xs uppercase tracking-wider text-slate-400">APY Proyectado</p>
                <p className="mt-1 font-mono text-3xl font-bold text-emerald-400">9,20%</p>
                <p className="mt-1 text-sm text-slate-300">
                  {MARKETPLACE_FALLBACK_LISTINGS[0]!.title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VacaMuertaOperators />

      <MacroInvestmentThesis />

      <section id="how-it-works" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">{l.howItWorks.title}</h2>
          <p className="mt-4 text-base text-slate-600 md:text-lg">{l.howItWorks.subtitle}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {[
            { icon: UserCheck, title: l.howItWorks.step1Title, desc: l.howItWorks.step1Desc },
            { icon: Building2, title: l.howItWorks.step2Title, desc: l.howItWorks.step2Desc },
            { icon: Wallet, title: l.howItWorks.step3Title, desc: l.howItWorks.step3Desc },
            { icon: ArrowLeftRight, title: l.howItWorks.step4Title, desc: l.howItWorks.step4Desc }
          ].map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md md:p-8"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <step.icon size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-blue-600">0{index + 1}</p>
                  <h3 className="mt-0.5 text-xl font-bold leading-snug text-slate-900">{step.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-slate-600">{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="properties" className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">{l.featured.title}</h2>
              <p className="mt-2 text-base text-slate-600 md:text-lg">{l.featured.subtitle}</p>
            </div>
            <MarketplaceCtaLink className="md:shrink-0">{l.featured.viewAll}</MarketplaceCtaLink>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:mt-10 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
            {MARKETPLACE_FALLBACK_LISTINGS.map((listing) => (
              <article
                key={listing.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-48 overflow-hidden sm:h-52">
                  <Image
                    src={listing.imageUrl}
                    alt={listing.title}
                    width={600}
                    height={400}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                    {formatMessage(l.featured.apyBadge, { apy: listing.apyPercent })}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900">{listing.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{listing.location}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      ${listing.pricePerTokenUsd} / {t.propertyCard.perToken}
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatMessage(l.featured.soldPercent, { percent: listing.soldPercent })}
                    </span>
                  </div>
                  <MarketplaceCtaLink className="mt-5">{t.common.investNow}</MarketplaceCtaLink>
                </div>
              </article>
            ))}
          </div>
          <TrustBadges className="mt-8 md:mt-10" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900 md:text-4xl">{l.benefits.title}</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-12 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {[
            { icon: CircleDollarSign, title: l.benefits.incomeTitle, desc: l.benefits.incomeDesc },
            { icon: TrendingUp, title: l.benefits.liquidityTitle, desc: l.benefits.liquidityDesc },
            { icon: ShieldCheck, title: l.benefits.complianceTitle, desc: l.benefits.complianceDesc }
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-200 p-6 md:p-8">
              <item.icon className="text-blue-600" size={32} />
              <h3 className="mt-4 text-xl font-bold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-slate-600">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-blue-800 py-12 text-white md:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold md:text-4xl">{l.cta.title}</h2>
          <p className="mt-4 text-base text-blue-100 md:text-lg">{l.cta.subtitle}</p>
          <MarketplaceCtaLink className="mt-8">{l.cta.button}</MarketplaceCtaLink>
          <div className="mx-auto mt-6 max-w-2xl">
            <TrustBadges
              variant="dark"
              className="justify-center [&_li]:border-white/20 [&_li]:bg-white/10 [&_li]:text-blue-50"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-900 px-4 py-10 text-slate-400 md:px-6 md:py-12">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex w-full flex-col gap-8 md:flex-row md:justify-between">
            <div className="w-full">
              <p className="text-lg font-bold text-white md:text-xl">Sanova Global</p>
              <p className="mt-2 text-sm leading-relaxed">{l.footer.tagline}</p>
            </div>
            <nav
              className="flex w-full flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-6"
              aria-label="Footer"
            >
              <Link href="/contacto" className="hover:text-white">
                {l.footer.contact}
              </Link>
              <Link href="/acceso" className="hover:text-white">
                {l.nav.marketplace}
              </Link>
              <Link href="/acceso" className="hover:text-white">
                {l.nav.platformAccess}
              </Link>
              <span className="cursor-default hover:text-white">{l.footer.privacy}</span>
              <span className="cursor-default hover:text-white">{l.footer.terms}</span>
            </nav>
          </div>
          <p className="mt-8 text-xs leading-relaxed md:mt-10">{l.footer.disclaimer}</p>
          <p className="mt-4 text-xs">{l.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}

