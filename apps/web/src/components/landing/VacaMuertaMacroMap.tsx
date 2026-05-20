'use client';

import Image from 'next/image';
import { useTranslation } from '../../i18n/LocaleProvider';

type VacaMuertaMacroMapProps = {
  className?: string;
};

const MAP_SRC = '/maps/vaca-muerta-cuenca.png';

/** Celeste de la cuenca en el mapa recoloreado (sky-400). */
const BASIN_BLUE = '#38bdf8';

/**
 * Locator map — cuenca Vaca Muerta. El cartel del callout derecho se cubre con texto vectorial nítido.
 */
export function VacaMuertaMacroMap({ className = '' }: VacaMuertaMacroMapProps) {
  const { mapFormationLine1, mapFormationLine2, mapFormationLine3 } =
    useTranslation().landing.macroThesis;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0A0E17] shadow-lg ring-1 ring-white/5 ${className}`.trim()}
    >
      <div className="relative aspect-[5/4] w-full min-h-[280px] sm:min-h-[320px] lg:min-h-[400px]">
        <div className="absolute inset-2 sm:inset-3">
          <Image
            src={MAP_SRC}
            alt="Mapa de Argentina. La formación Vaca Muerta se ubica en el oeste, en Neuquén y provincias limítrofes."
            fill
            className="object-contain object-center"
            sizes="(max-width: 1024px) 100vw, 560px"
            quality={95}
            priority={false}
          />

          {/* Cubre el cartel pixelado del callout — mismo celeste que la cuenca */}
          <div
            className="pointer-events-none absolute z-10 flex w-fit max-w-[32%] flex-col items-center justify-center gap-px text-center text-slate-900"
            style={{
              left: 'calc(49% + 1.5cm)',
              top: 'calc(41.5% + 1cm)',
              padding: '0.65cm 0.32cm',
              backgroundColor: BASIN_BLUE
            }}
            aria-hidden
          >
            <span className="text-[9px] font-extrabold tracking-wide sm:text-[11px] md:text-sm">
              {mapFormationLine1}
            </span>
            <span
              className="inline-block origin-center text-[11px] font-extrabold leading-none tracking-[-0.06em] sm:text-[13px] md:text-base"
              style={{ transform: 'scaleX(0.88) scaleY(1.22)' }}
            >
              {mapFormationLine2}
            </span>
            <span
              className="inline-block origin-center text-[11px] font-extrabold leading-none tracking-[-0.06em] sm:text-[13px] md:text-base"
              style={{ transform: 'scaleX(0.88) scaleY(1.22)' }}
            >
              {mapFormationLine3}
            </span>
          </div>

          <span
            className="pointer-events-none absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:h-12 sm:w-12"
            style={{ left: 'calc(22% + 0.5cm)', top: 'calc(58% - 3cm)' }}
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-[#0A0E17]" />
          </span>
        </div>
      </div>
    </div>
  );
}
