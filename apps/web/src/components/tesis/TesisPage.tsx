'use client';

import Link from 'next/link';
import { LandingHeader } from '../landing/LandingHeader';
import { useTranslation } from '../../i18n/LocaleProvider';
import { TesisDataSection } from './TesisDataSection';
import { TesisFiscalFlow } from './TesisFiscalFlow';
import { TesisHero } from './TesisHero';
import { TesisYieldCta } from './TesisYieldCta';

export function TesisPage() {
  const t = useTranslation();

  return (
    <div className="min-h-screen bg-[#0A0E17]">
      <LandingHeader />

      <TesisHero />
      <TesisDataSection />
      <TesisFiscalFlow />
      <TesisYieldCta />

      <footer className="border-t border-slate-800 px-4 py-8 text-center text-sm text-slate-500 md:px-6">
        <Link href="/" className="font-medium text-sky-400 hover:text-sky-300">
          ← {t.tesis.footerBack}
        </Link>
      </footer>
    </div>
  );
}
