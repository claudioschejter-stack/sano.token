'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
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
import { VacaMuertaOperators } from './VacaMuertaOperators';

export function LandingPage() {
  const t = useTranslation();
  const l = t.landing;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingHeader />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#0A0E17] via-[#111827] to-[#1e3a5f] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #3B82F6 0%, transparent 40%), radial-gradient(circle at 80% 60%, #F97316 0%, transparent 35%)'
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:gap-12 sm:py-20 lg:grid-cols-2 lg:items-stretch lg:gap-14 lg:py-28">
          <div className="flex flex-col justify-center lg:max-w-xl lg:pr-2 xl:max-w-[34rem]">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">{l.hero.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {l.hero.title.split('\n').map((line) => (
                <span key={line} className="block last:text-blue-200">
                  {line}
                </span>
              ))}
            </h1>
            <HeroSubtitle hero={l.hero} />
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
              >
                {l.hero.ctaPrimary}
                <ArrowRight size={18} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {l.hero.ctaSecondary}
              </a>
            </div>
            <p className="mt-8 text-sm text-slate-400">{l.hero.trustLine}</p>
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
              <div className="absolute -bottom-5 -left-5 rounded-xl border border-white/20 bg-[#111827]/95 p-4 shadow-xl backdrop-blur">
                <p className="text-xs uppercase tracking-wider text-slate-400">APY Proyectado</p>
                <p className="mt-1 font-mono text-3xl font-bold text-emerald-400">9,20%</p>
                <p className="mt-1 text-sm text-slate-300">Anelo Tower — Oficinas Premium</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VacaMuertaOperators />

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-slate-900">{l.howItWorks.title}</h2>
          <p className="mt-4 text-slate-600">{l.howItWorks.subtitle}</p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {[
            { icon: UserCheck, title: l.howItWorks.step1Title, desc: l.howItWorks.step1Desc },
            { icon: Building2, title: l.howItWorks.step2Title, desc: l.howItWorks.step2Desc },
            { icon: Wallet, title: l.howItWorks.step3Title, desc: l.howItWorks.step3Desc }
          ].map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <step.icon size={24} />
              </div>
              <p className="mt-6 text-sm font-semibold text-blue-600">0{index + 1}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-slate-600">{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="properties" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">{l.featured.title}</h2>
              <p className="mt-2 text-slate-600">{l.featured.subtitle}</p>
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              {l.featured.viewAll}
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {MARKETPLACE_FALLBACK_LISTINGS.map((listing) => (
              <article
                key={listing.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-52 overflow-hidden">
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
                  <Link
                    href={`/marketplace/${listing.id}/checkout`}
                    className="mt-5 flex w-full items-center justify-center rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
                  >
                    {t.common.investNow}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900">{l.benefits.title}</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            { icon: CircleDollarSign, title: l.benefits.incomeTitle, desc: l.benefits.incomeDesc },
            { icon: TrendingUp, title: l.benefits.liquidityTitle, desc: l.benefits.liquidityDesc },
            { icon: ShieldCheck, title: l.benefits.complianceTitle, desc: l.benefits.complianceDesc }
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-200 p-8">
              <item.icon className="text-blue-600" size={32} />
              <h3 className="mt-4 text-xl font-bold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-slate-600">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-blue-800 py-16 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold">{l.cta.title}</h2>
          <p className="mt-4 text-blue-100">{l.cta.subtitle}</p>
          <Link
            href="/marketplace"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50"
          >
            {l.cta.button}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-900 px-6 py-12 text-slate-400">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div>
              <p className="text-xl font-bold text-white">Sanova Global</p>
              <p className="mt-2 text-sm">{l.footer.tagline}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/marketplace" className="hover:text-white">
                {l.nav.marketplace}
              </Link>
              <Link href="/acceso" className="hover:text-white">
                {l.nav.platformAccess}
              </Link>
              <span className="cursor-default hover:text-white">{l.footer.privacy}</span>
              <span className="cursor-default hover:text-white">{l.footer.terms}</span>
            </div>
          </div>
          <p className="mt-10 text-xs leading-relaxed">{l.footer.disclaimer}</p>
          <p className="mt-4 text-xs">{l.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}

