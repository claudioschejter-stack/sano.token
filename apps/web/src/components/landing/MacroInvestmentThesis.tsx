'use client';

import { useTranslation } from '../../i18n/LocaleProvider';
import { PatagoniaBasinMap } from './PatagoniaBasinMap';

function DataStatCard({ value, label }: { value: string; label: string }) {
  return (
    <article className="rounded-xl border border-slate-200/90 bg-white/70 px-5 py-5 shadow-sm backdrop-blur-sm transition duration-300 hover:border-blue-200/80 hover:shadow-md hover:shadow-blue-500/5">
      <p className="font-mono text-2xl font-semibold tracking-tight text-blue-600 sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium leading-snug text-slate-600">{label}</p>
    </article>
  );
}

/**
 * Macro context & investment thesis — Vaca Muerta energy → RWA real estate bridge.
 *
 * @example
 * import { MacroInvestmentThesis } from './MacroInvestmentThesis';
 * <MacroInvestmentThesis />
 */
export function MacroInvestmentThesis() {
  const m = useTranslation().landing.macroThesis;

  const stats = [
    { value: m.stat1Value, label: m.stat1Label },
    { value: m.stat2Value, label: m.stat2Label },
    { value: m.stat3Value, label: m.stat3Label }
  ];

  return (
    <section
      id="macro-thesis"
      className="relative border-b border-slate-200 bg-white"
      aria-labelledby="macro-thesis-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(circle at 90% 10%, rgba(59,130,246,0.06) 0%, transparent 45%), radial-gradient(circle at 5% 90%, rgba(15,23,42,0.04) 0%, transparent 40%)'
        }}
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="grid grid-cols-1 gap-10 md:gap-12 lg:grid-cols-12 lg:gap-16 lg:items-start">
          <div className="lg:col-span-5">
            <PatagoniaBasinMap />
            <p className="mt-5 font-mono text-[11px] font-medium uppercase leading-relaxed tracking-wider text-slate-500 sm:text-xs">
              {m.mapCaption}
            </p>
          </div>

          <div className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              {m.eyebrow}
            </p>
            <h2
              id="macro-thesis-title"
              className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-[2.35rem] lg:leading-tight"
            >
              {m.title.split('\n').map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-600 sm:text-lg">{m.intro}</p>

            <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2 lg:grid-cols-3">
              {stats.map((stat) => (
                <DataStatCard key={stat.label} value={stat.value} label={stat.label} />
              ))}
            </div>

            <div className="mt-14 border-t border-slate-200/90 pt-10">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {m.thesisTitle}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                {m.thesisDesc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
