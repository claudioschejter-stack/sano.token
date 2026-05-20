/** Minimal institutional map — South America with Patagonia activity pulse. */
export function PatagoniaBasinMap() {
  const pulseX = 158;
  const pulseY = 318;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6 md:p-8">
      <svg
        viewBox="0 0 360 420"
        className="mx-auto h-auto w-full max-w-[320px] text-slate-400"
        role="img"
        aria-label="Mapa de Sudamérica con ubicación en la Patagonia, Argentina"
      >
        <defs>
          <linearGradient id="sa-land-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="arg-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>

        {/* Grid — terminal aesthetic */}
        <g stroke="#e2e8f0" strokeWidth="0.5" opacity="0.9">
          {[80, 140, 200, 260, 320].map((y) => (
            <line key={`h-${y}`} x1="24" y1={y} x2="336" y2={y} />
          ))}
          {[60, 120, 180, 240, 300].map((x) => (
            <line key={`v-${x}`} x1={x} y1="32" x2={x} y2="388" />
          ))}
        </g>

        {/* South America — simplified silhouette */}
        <path
          d="M108 52 C132 36 168 40 192 58 L218 72 C248 68 278 88 292 118 L308 148 C322 168 328 198 318 228 L302 268 C288 308 268 348 238 372 L198 392 C168 404 138 398 118 378 L88 348 C68 318 58 278 62 238 L72 198 C78 158 88 118 98 88 Z"
          fill="url(#sa-land-fill)"
          stroke="#94a3b8"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />

        {/* Argentina */}
        <path
          d="M118 168 L198 152 L228 168 L238 248 L222 328 L178 352 L132 338 L108 268 L112 208 Z"
          fill="url(#arg-highlight)"
          stroke="#64748b"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />

        {/* Vaca Muerta / Patagonia basin hint */}
        <ellipse
          cx={pulseX}
          cy={pulseY}
          rx="36"
          ry="22"
          fill="none"
          stroke="#93c5fd"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.85"
        />

        {/* Static anchor (pulse via Tailwind overlay) */}
        <circle cx={pulseX} cy={pulseY} r="4" className="fill-blue-600" />

        {/* Compass */}
        <g transform="translate(300, 52)" className="text-slate-400">
          <circle r="14" fill="white" stroke="#cbd5e1" strokeWidth="1" />
          <path d="M0 -8 L0 8 M-8 0 L8 0" stroke="#94a3b8" strokeWidth="1" />
          <text
            y="-10"
            textAnchor="middle"
            className="fill-slate-500 text-[9px] font-semibold"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            N
          </text>
        </g>
      </svg>

      {/* Patagonia pulse — Tailwind @keyframes ping */}
      <span
        className="pointer-events-none absolute left-[41%] top-[72%] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:left-[42%] sm:top-[73%]"
        aria-hidden
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-50" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white/90" />
      </span>
    </div>
  );
}
