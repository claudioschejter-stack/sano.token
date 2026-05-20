import type { Messages } from '../../i18n/locales/en';

type HeroCopy = Messages['landing']['hero'];

const bodyClass = 'text-base leading-relaxed text-slate-300 sm:text-lg';

export function HeroSubtitle({ hero }: { hero: HeroCopy }) {
  const { subtitleHighlight, subtitleClose } = hero;

  if (subtitleHighlight && subtitleClose) {
    return (
      <div className="mt-6 space-y-4">
        <blockquote className="rounded-xl border border-blue-400/35 bg-gradient-to-br from-blue-500/10 to-white/5 px-4 py-4 shadow-lg shadow-black/20 backdrop-blur-sm sm:px-5 sm:py-5">
          <p className={`${bodyClass} font-semibold text-blue-50`}>{subtitleHighlight}</p>
        </blockquote>
        <p className={bodyClass}>{subtitleClose}</p>
      </div>
    );
  }

  return <p className={`mt-6 max-w-2xl ${bodyClass}`}>{hero.subtitle}</p>;
}
