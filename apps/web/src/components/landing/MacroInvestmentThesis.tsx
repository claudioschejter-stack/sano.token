'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

const MAP_SRC = '/mapa-vaca-muerta.png';

/**
 * Macro context & investment thesis — terminal-style RWA landing block.
 */
export function MacroInvestmentThesis() {
  const m = useTranslation().landing.macroThesis;

  return (
    <section
      id="macro-thesis"
      className="relative border-b border-slate-800 bg-[#0A0E17] text-slate-100"
      aria-labelledby="macro-thesis-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 0%, rgba(59,130,246,0.12) 0%, transparent 45%), radial-gradient(circle at 85% 100%, rgba(249,115,22,0.08) 0%, transparent 40%)'
        }}
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-4 py-24 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          {m.eyebrow}
        </p>

        <div className="mt-10 flex flex-col gap-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
          <figure className="flex w-full flex-col lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/50 shadow-lg ring-1 ring-white/5">
              <img
                src={MAP_SRC}
                alt="Mapa de Sudamérica con la ubicación de Vaca Muerta en la Patagonia, Argentina"
                className="aspect-[17/26] h-auto w-full object-contain object-center sm:aspect-[2/3]"
                loading="lazy"
                decoding="async"
              />
            </div>
            <figcaption className="mt-4 text-sm text-slate-400">{m.mapCaption}</figcaption>
          </figure>

          <div className="flex w-full flex-col lg:col-span-7">
            <h2
              id="macro-thesis-title"
              className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl"
            >
              {m.title}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-300 lg:text-lg">{m.intro}</p>

            <h3 className="mt-10 text-xl font-semibold tracking-tight text-white">
              {m.thesisTitle}
            </h3>
            <p className="mt-4 text-base leading-relaxed text-slate-300 lg:text-lg">
              {m.thesisDesc}
            </p>

            <ul className="mt-8 space-y-4" role="list">
              {m.benefits.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-400"
                    aria-hidden
                  />
                  <span className="text-sm leading-relaxed text-slate-300 sm:text-base">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/marketplace"
              className="mt-10 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 md:w-auto md:text-sm"
            >
              {m.cta}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
