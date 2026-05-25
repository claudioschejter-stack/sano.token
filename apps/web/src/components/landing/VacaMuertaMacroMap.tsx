'use client';

import Image from 'next/image';

type VacaMuertaMacroMapProps = {
  className?: string;
};

const MAP_SRC = '/maps/vaca-muerta-cuenca.png';

/** Mapa de la cuenca Vaca Muerta — imagen completa, centrada, sin overlays. */
export function VacaMuertaMacroMap({ className = '' }: VacaMuertaMacroMapProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0A0E17] shadow-lg ring-1 ring-white/5 ${className}`.trim()}
    >
      <div className="relative aspect-square w-full p-3 sm:p-4">
        <div className="relative h-full w-full">
          <Image
            src={MAP_SRC}
            alt="Mapa de Argentina. La formación Vaca Muerta se ubica en el oeste, en Neuquén y provincias limítrofes."
            fill
            className="pointer-events-none object-contain object-center"
            sizes="(max-width: 1024px) 100vw, 560px"
            quality={95}
            priority={false}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
