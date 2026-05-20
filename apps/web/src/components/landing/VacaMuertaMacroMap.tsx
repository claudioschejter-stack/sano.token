type VacaMuertaMacroMapProps = {
  className?: string;
};

const VACA_MUERTA_CX = 118;
const VACA_MUERTA_CY = 368;

/** Minimal South America SVG — institutional palette for macro context section. */
export function VacaMuertaMacroMap({ className = '' }: VacaMuertaMacroMapProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700/80 shadow-lg ring-1 ring-white/5 ${className}`.trim()}
    >
      <div className="relative aspect-[17/26] w-full min-h-[280px] sm:aspect-[2/3] lg:aspect-auto lg:min-h-[400px]">
        {/* Pulse — Vaca Muerta energy activity */}
        <span
          className="pointer-events-none absolute left-[33%] top-[68%] z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center lg:left-[34%] lg:top-[69%]"
          aria-hidden
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-50" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-400 ring-2 ring-slate-900/80" />
        </span>

        <svg
          viewBox="0 0 340 520"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Mapa de Sudamérica con la cuenca de Vaca Muerta en Neuquén, Argentina"
        >
          {/* Ocean */}
          <rect width="340" height="520" className="fill-slate-900" />

          {/* South America */}
          <path
            d="M72 88 C98 62 138 58 168 78 L198 92 C228 86 262 98 284 128 L302 162 C318 192 322 228 312 262 L296 308 C278 358 252 402 218 432 L178 458 C148 472 118 468 96 448 L72 412 C52 372 44 328 48 282 L58 228 C64 178 66 128 72 88 Z"
            className="fill-slate-700"
            stroke="#475569"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          {/* Brazil — subtle eastern mass */}
          <path
            d="M198 118 C238 108 278 128 298 168 L308 218 C312 268 300 318 272 358 L238 392 C212 408 188 398 178 362 L172 298 C168 238 176 178 198 118 Z"
            className="fill-slate-600"
            stroke="#475569"
            strokeWidth="0.75"
            strokeLinejoin="round"
          />

          {/* Southern cone (Argentina / Chile) */}
          <path
            d="M88 198 L118 188 L148 198 L168 228 L178 278 L172 338 L158 398 L132 448 L102 468 L78 438 L68 378 L72 318 L80 258 Z"
            className="fill-slate-700"
            stroke="#64748b"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />

          {/* Vaca Muerta basin — Neuquén */}
          <ellipse
            cx={VACA_MUERTA_CX}
            cy={VACA_MUERTA_CY}
            rx="44"
            ry="28"
            className="fill-sky-400"
            fillOpacity="0.85"
          />
          <ellipse
            cx={VACA_MUERTA_CX}
            cy={VACA_MUERTA_CY}
            rx="44"
            ry="28"
            fill="none"
            className="stroke-sky-300"
            strokeWidth="1.25"
            strokeDasharray="4 3"
          />
          <ellipse
            cx={VACA_MUERTA_CX}
            cy={VACA_MUERTA_CY}
            rx="20"
            ry="12"
            className="fill-sky-400"
          />

          <circle
            cx={VACA_MUERTA_CX}
            cy={VACA_MUERTA_CY}
            r="4"
            className="fill-sky-300"
            stroke="#0f172a"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}
