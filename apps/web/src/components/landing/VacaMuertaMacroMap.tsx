import Image from 'next/image';

type VacaMuertaMacroMapProps = {
  className?: string;
};

const MAP_SRC = '/maps/vaca-muerta-cuenca.png';

/**
 * Locator map — cuenca Vaca Muerta (imagen en public/maps, paleta institucional).
 */
export function VacaMuertaMacroMap({ className = '' }: VacaMuertaMacroMapProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#0A0E17] shadow-lg ring-1 ring-white/5 ${className}`.trim()}
    >
      <div className="relative aspect-[5/4] w-full min-h-[280px] sm:min-h-[320px] lg:min-h-[400px]">
        <span
          className="pointer-events-none absolute left-[22%] top-[58%] z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:h-12 sm:w-12"
          aria-hidden
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-[#0A0E17]" />
        </span>

        <Image
          src={MAP_SRC}
          alt="Mapa de Argentina. La formación Vaca Muerta se ubica en el oeste, en Neuquén y provincias limítrofes."
          fill
          className="object-contain object-center p-2 sm:p-3"
          sizes="(max-width: 1024px) 100vw, 42vw"
          priority={false}
        />
      </div>
    </div>
  );
}
