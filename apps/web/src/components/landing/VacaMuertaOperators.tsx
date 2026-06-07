'use client';

import { VACA_MUERTA_OPERATORS } from '../../data/vacaMuertaOperators';
import { useTranslation } from '../../i18n/LocaleProvider';
import { OperatorLogoMarquee } from './OperatorLogoMarquee';

function OperatorsHighlight({ text }: { text: string }) {
  return (
    <p className="mx-auto max-w-3xl text-center">
      <span className="inline-flex flex-wrap items-center justify-center rounded-full border border-blue-200/70 bg-gradient-to-r from-blue-50/90 via-white to-orange-50/80 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04] sm:px-6 sm:text-[0.95rem]">
        {text}
      </span>
    </p>
  );
}

export function VacaMuertaOperators() {
  const t = useTranslation();
  const { title, subtitle } = t.landing.operators;

  const marqueeLogos = VACA_MUERTA_OPERATORS.map((operator) => ({
    src: operator.logoUrl,
    alt: operator.name,
    name: operator.name,
    className: operator.logoClassName
  }));

  return (
    <section
      className="relative overflow-x-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-50"
      aria-labelledby="vaca-muerta-operators-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 0%, rgba(59,130,246,0.08) 0%, transparent 42%), radial-gradient(circle at 85% 100%, rgba(249,115,22,0.06) 0%, transparent 38%)'
        }}
      />
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden px-4 py-16 sm:px-6 md:px-6 md:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2
            id="vaca-muerta-operators-title"
            className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
            {title}
          </h2>
          {subtitle ? (
            <div className="mt-6">
              <OperatorsHighlight text={subtitle} />
            </div>
          ) : null}
        </div>

        <div className="mt-12 w-full max-w-full overflow-hidden sm:mt-14">
          <OperatorLogoMarquee
            logos={marqueeLogos}
            durationSeconds={80}
            ariaLabel={title}
          />
        </div>
      </div>
    </section>
  );
}
