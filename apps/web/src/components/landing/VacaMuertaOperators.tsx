'use client';

import Image from 'next/image';
import { VACA_MUERTA_OPERATORS } from '../../data/vacaMuertaOperators';
import { useTranslation } from '../../i18n/LocaleProvider';

function OperatorCard({
  name,
  logoUrl,
  logoClassName
}: {
  name: string;
  logoUrl: string;
  logoClassName?: string;
}) {
  const isSvg = logoUrl.endsWith('.svg');
  const logoClasses =
    logoClassName ??
    'mx-auto h-10 w-auto max-w-[8.75rem] object-contain sm:h-12 sm:max-w-[9.25rem]';

  return (
    <article className="group flex h-full flex-col items-center rounded-2xl border border-slate-200/90 bg-white px-3 py-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-blue-200/80 hover:shadow-md hover:shadow-blue-500/10">
      <div className="flex h-14 w-full items-center justify-center px-1 sm:h-16">
        <Image
          src={logoUrl}
          alt={name}
          width={isSvg ? 128 : 168}
          height={56}
          unoptimized={isSvg}
          className={`transition duration-300 group-hover:scale-105 ${logoClasses}`}
        />
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-center text-[11px] font-semibold leading-snug tracking-tight text-slate-800 sm:min-h-0 sm:text-xs">
        {name}
      </p>
    </article>
  );
}

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

  return (
    <section
      className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-50"
      aria-labelledby="vaca-muerta-operators-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 0%, rgba(59,130,246,0.08) 0%, transparent 42%), radial-gradient(circle at 85% 100%, rgba(249,115,22,0.06) 0%, transparent 38%)'
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="vaca-muerta-operators-title"
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            {title}
          </h2>
          {subtitle ? (
            <div className="mt-6">
              <OperatorsHighlight text={subtitle} />
            </div>
          ) : null}
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6 lg:gap-5">
          {VACA_MUERTA_OPERATORS.map((operator) => (
            <li key={operator.id}>
              <OperatorCard
                name={operator.name}
                logoUrl={operator.logoUrl}
                logoClassName={operator.logoClassName}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
