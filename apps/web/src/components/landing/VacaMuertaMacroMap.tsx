'use client';

import Image from 'next/image';
import { useTranslation } from '../../i18n/LocaleProvider';

type VacaMuertaMacroMapProps = {
  className?: string;
};

const MAP_SRC = '/maps/vaca-muerta-cuenca.jpg';

/** Mapa de la cuenca Vaca Muerta — ocupa todo el marco del contenedor. */
export function VacaMuertaMacroMap({ className = '' }: VacaMuertaMacroMapProps) {
  const mapAlt = useTranslation().landing.macroThesis.mapAlt;

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0A0E17] shadow-lg ring-1 ring-white/5 ${className}`.trim()}
    >
      <Image
        src={MAP_SRC}
        alt={mapAlt}
        fill
        className="pointer-events-none object-cover object-center"
        sizes="(max-width: 1024px) 100vw, 560px"
        quality={95}
        priority={false}
        draggable={false}
      />
    </div>
  );
}
