type PatagoniaBasinMapProps = {
  className?: string;
};

/** South America locator map — Vaca Muerta basin highlighted for international investors. */
export function PatagoniaBasinMap({ className = '' }: PatagoniaBasinMapProps) {
  const vacaMuertaX = 128;
  const vacaMuertaY = 368;

  return (
    <div
      className={`relative flex min-h-[300px] w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100/90 shadow-sm ring-1 ring-slate-900/[0.03] md:min-h-[420px] lg:min-h-0 ${className}`.trim()}
    >
      <svg
        viewBox="0 0 340 520"
        className="h-full w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mapa de Sudamérica con la ubicación de Vaca Muerta en el oeste de Argentina"
      >
        <defs>
          <linearGradient id="sa-continent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="sa-argentina" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#eff6ff" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          <radialGradient id="sa-vaca-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        <rect width="340" height="520" fill="#fafbfc" />

        <g stroke="#e2e8f0" strokeWidth="0.5" opacity="0.85">
          {[100, 180, 260, 340, 420].map((y) => (
            <line key={`h-${y}`} x1="20" y1={y} x2="320" y2={y} />
          ))}
          {[70, 140, 210, 280].map((x) => (
            <line key={`v-${x}`} x1={x} y1="40" x2={x} y2="490" />
          ))}
        </g>

        {/* South America — simplified continental silhouette */}
        <path
          d="M72 88 C98 62 138 58 168 78 L198 92 C228 86 262 98 284 128 L302 162 C318 192 322 228 312 262 L296 308 C278 358 252 402 218 432 L178 458 C148 472 118 468 96 448 L72 412 C52 372 44 328 48 282 L58 228 C64 178 66 128 72 88 Z"
          fill="url(#sa-continent)"
          stroke="#94a3b8"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Brazil (east) — subtle separation */}
        <path
          d="M198 118 C238 108 278 128 298 168 L308 218 C312 268 300 318 272 358 L238 392 C212 408 188 398 178 362 L172 298 C168 238 176 178 198 118 Z"
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth="0.9"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Argentina & Chile (southern cone, west) */}
        <path
          d="M88 198 L118 188 L148 198 L168 228 L178 278 L172 338 L158 398 L132 448 L102 468 L78 438 L68 378 L72 318 L80 258 Z"
          fill="url(#sa-argentina)"
          stroke="#64748b"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />

        {/* Vaca Muerta basin — proportional area in Neuquén (western Argentina) */}
        <ellipse
          cx={vacaMuertaX}
          cy={vacaMuertaY}
          rx="42"
          ry="26"
          fill="url(#sa-vaca-glow)"
        />
        <ellipse
          cx={vacaMuertaX}
          cy={vacaMuertaY}
          rx="42"
          ry="26"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.2"
          strokeDasharray="5 4"
          opacity="0.9"
        />
        <ellipse
          cx={vacaMuertaX}
          cy={vacaMuertaY}
          rx="18"
          ry="11"
          fill="#f97316"
          fillOpacity="0.22"
          stroke="#ea580c"
          strokeWidth="1"
        />

        <circle cx={vacaMuertaX} cy={vacaMuertaY} r="4.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />

        {/* Callout label */}
        <path
          d={`M ${vacaMuertaX + 22} ${vacaMuertaY - 8} L 198 318`}
          fill="none"
          stroke="#64748b"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
        <rect x="168" y="298" width="118" height="28" rx="6" fill="white" fillOpacity="0.95" stroke="#e2e8f0" />
        <text
          x="227"
          y="316"
          textAnchor="middle"
          className="fill-slate-800"
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontWeight: 600 }}
        >
          Vaca Muerta
        </text>

        {/* Regional context labels */}
        <text
          x="248"
          y="248"
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9px', fontWeight: 500 }}
        >
          Brasil
        </text>
        <text
          x="108"
          y="318"
          textAnchor="middle"
          className="fill-slate-500"
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9px', fontWeight: 600 }}
        >
          Argentina
        </text>
        <text
          x="170"
          y="72"
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em' }}
        >
          SUDAMÉRICA
        </text>

        <g transform="translate(288, 56)">
          <circle r="13" fill="white" stroke="#cbd5e1" strokeWidth="1" />
          <path d="M0 -7 L0 7 M-7 0 L7 0" stroke="#94a3b8" strokeWidth="0.9" />
          <text
            y="-9"
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontFamily: 'system-ui, sans-serif', fontSize: '8px', fontWeight: 700 }}
          >
            N
          </text>
        </g>
      </svg>

      <span
        className="pointer-events-none absolute left-[36%] top-[69%] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center lg:left-[37%] lg:top-[70%]"
        aria-hidden
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
      </span>
    </div>
  );
}
