'use client';

import { Check } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BrandGradientText } from '../brand/BrandGradientText';
import { MarketplaceCtaLink } from './MarketplaceCtaLink';
import { VacaMuertaMacroMap } from './VacaMuertaMacroMap';

/**
 * Macro context & investment thesis — terminal-style RWA landing block.
 */
export function MacroInvestmentThesis() {
  const m = useTranslation().landing.macroThesis;

  return (
    <section
      id="macro-thesis"
      className="relative overflow-hidden border-b border-slate-800 bg-[#0A0E17] text-slate-100"
      aria-labelledby="macro-thesis-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 0%, rgba(56,189,248,0.1) 0%, transparent 45%), radial-gradient(circle at 85% 100%, rgba(15,23,42,0.5) 0%, transparent 40%)'
        }}
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-4 py-24 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          {m.eyebrow}
        </p>

        <div className="mt-10 flex min-w-0 flex-col gap-12 lg:grid lg:grid-cols-12 lg:items-stretch">
          <figure className="flex min-w-0 w-full flex-col lg:col-span-5">
            <div className="relative aspect-[3/4] w-full min-w-0 lg:aspect-auto lg:min-h-[28rem] lg:flex-1">
              <VacaMuertaMacroMap className="absolute inset-0 h-full w-full" />
            </div>
            <figcaption className="mt-4 whitespace-pre-line text-sm text-slate-400">
              {m.mapCaption}
            </figcaption>
          </figure>

          <div className="flex min-w-0 w-full flex-col lg:col-span-7">
            <h2
              id="macro-thesis-title"
              className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl"
            >
              <BrandGradientText glow>{m.title}</BrandGradientText>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-300 lg:text-lg">{m.intro}</p>

            <h3 className="mt-8 text-xl font-semibold tracking-tight text-white">
              {m.thesisTitle}
            </h3>
            <p className="mt-4 text-base leading-relaxed text-slate-300 lg:text-lg">
              {m.thesisDesc}
            </p>

            <ul className="mt-8 space-y-4" role="list">
              {m.benefits.map((item) => (
                <li key={item} className="flex gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden />
                  <span className="text-sm leading-relaxed text-slate-300 sm:text-base">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <MarketplaceCtaLink className="mt-10">{m.cta}</MarketplaceCtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
