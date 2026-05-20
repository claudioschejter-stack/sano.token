'use client';

import Image from 'next/image';
import { useState } from 'react';
import { VACA_MUERTA_OPERATORS } from '../../data/vacaMuertaOperators';
import { useTranslation } from '../../i18n/LocaleProvider';

function OperatorLogo({ name, domain }: { name: string; domain: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = `https://logo.clearbit.com/${domain}`;

  if (failed) {
    return (
      <span className="text-center text-sm font-semibold tracking-tight text-slate-700">{name}</span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={name}
      width={140}
      height={48}
      className="mx-auto h-10 w-auto max-w-[8.5rem] object-contain grayscale transition duration-300 hover:grayscale-0"
      onError={() => setFailed(true)}
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
        <ul className="mt-10 grid grid-cols-2 items-center gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {VACA_MUERTA_OPERATORS.map((operator) => (
            <li key={operator.id} className="flex min-h-[3.5rem] items-center justify-center px-2">
              <OperatorLogo name={operator.name} domain={operator.domain} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
