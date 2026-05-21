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
 * Mapa unificado: imagen + cartel + marcador comparten el mismo lienzo (5:4) y escalan juntos.
 */
export function VacaMuertaMacroMap({ className = '' }: VacaMuertaMacroMapProps) {
  const { mapFormationLine1, mapFormationLine2, mapFormationLine3 } =
    useTranslation().landing.macroThesis;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0A0E17] shadow-lg ring-1 ring-white/5 ${className}`.trim()}
    >
      <div className="relative aspect-[5/4] w-full min-h-[280px] p-2 sm:min-h-[320px] sm:p-3 lg:min-h-[400px]">
        {/* Capa única — foto y overlays se mueven y escalan como una sola imagen */}
        <div className="relative h-full w-full select-none [container-type:size]">
          <Image
            src={MAP_SRC}
            alt="Mapa de Argentina. La formación Vaca Muerta se ubica en el oeste, en Neuquén y provincias limítrofes."
            fill
            className="pointer-events-none object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 560px"
            quality={95}
            priority={false}
            draggable={false}
          />

          <div
            className="pointer-events-none absolute z-10 flex w-fit max-w-[34%] flex-col items-center justify-center gap-px rounded-md text-center leading-[1.08] text-slate-900 sm:rounded-lg"
            style={{
              left: '62%',
              top: '55%',
              padding: '3% 4.5%',
              backgroundColor: BASIN_BLUE
            }}
            aria-hidden
          >
            <span className="font-extrabold tracking-wide" style={{ fontSize: '3.2cqi' }}>
              {mapFormationLine1}
            </span>
            <span
              className="inline-block origin-center font-extrabold leading-none tracking-[-0.06em]"
              style={{ fontSize: '3.8cqi', transform: 'scaleX(0.88) scaleY(1.22)' }}
            >
              {mapFormationLine2}
            </span>
            <span
              className="inline-block origin-center font-extrabold leading-none tracking-[-0.06em]"
              style={{ fontSize: '3.8cqi', transform: 'scaleX(0.88) scaleY(1.22)' }}
            >
              {mapFormationLine3}
            </span>
          </div>

          <span
            className="pointer-events-none absolute z-20 flex aspect-square min-h-2.5 min-w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: '28%', top: '58%', width: '4.5cqi' }}
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
            <span className="relative inline-flex h-[38%] w-[38%] min-h-2 min-w-2 rounded-full bg-sky-400 ring-2 ring-[#0A0E17]" />
          </span>
        </div>
      </div>
    </div>
  );
}
