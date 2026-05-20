'use client';

import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VACA_MUERTA_OPERATORS } from '../../data/vacaMuertaOperators';
import { useTranslation } from '../../i18n/LocaleProvider';

function logoSources(domain: string, logoUrl?: string) {
  if (logoUrl) {
    return [logoUrl];
  }

  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`
  ];
}

function OperatorLogo({ domain, logoUrl }: { domain: string; logoUrl?: string }) {
  const sources = useMemo(() => logoSources(domain, logoUrl), [domain, logoUrl]);
  const [sourceIndex, setSourceIndex] = useState(0);

  const currentSrc = sources[sourceIndex];
  const isFavicon = currentSrc?.includes('favicons') || currentSrc?.includes('duckduckgo');

  if (!currentSrc) {
    return (
      <span
        className="flex h-12 w-28 items-center justify-center rounded-md bg-slate-200/80 text-slate-400"
        aria-hidden
      >
        <Building2 size={22} strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt=""
      width={isFavicon ? 48 : 140}
      height={isFavicon ? 48 : 48}
      unoptimized={isFavicon}
      className={`mx-auto object-contain grayscale transition duration-300 hover:grayscale-0 ${
        isFavicon ? 'h-10 w-10' : 'h-10 w-auto max-w-[8.5rem]'
      }`}
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}

export function VacaMuertaOperators() {
  const t = useTranslation();

  return (
    <section className="border-b border-slate-200 bg-slate-50" aria-labelledby="vaca-muerta-operators-title">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <h2
          id="vaca-muerta-operators-title"
          className="text-center text-xl font-bold tracking-tight text-slate-900 md:text-2xl"
        >
          {t.landing.operators.title}
        </h2>
        {t.landing.operators.subtitle ? (
          <p className="mt-3 text-center text-sm text-slate-600">{t.landing.operators.subtitle}</p>
        ) : null}
        <ul className="mt-10 grid grid-cols-2 items-stretch gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {VACA_MUERTA_OPERATORS.map((operator) => (
            <li
              key={operator.id}
              className="flex min-h-[4.5rem] flex-col items-center justify-center gap-2 px-1"
              aria-label={operator.name}
              title={operator.name}
            >
              <OperatorLogo domain={operator.domain} logoUrl={operator.logoUrl} />
              <span className="sr-only">{operator.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
