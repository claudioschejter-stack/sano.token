import type { Messages } from '../../i18n/locales/en';

type HeroCopy = Messages['landing']['hero'];

export function HeroSubtitle({ hero }: { hero: HeroCopy }) {
  const { subtitleLead, subtitleHighlight, subtitleClose } = hero;

  if (subtitleLead && subtitleHighlight && subtitleClose) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-base leading-relaxed text-slate-300 sm:text-lg">{subtitleLead}</p>
        <blockquote className="rounded-xl border border-blue-400/35 bg-gradient-to-br from-blue-500/10 to-white/5 px-4 py-4 shadow-lg shadow-black/20 backdrop-blur-sm sm:px-5 sm:py-5">
          <p className="text-base font-semibold leading-relaxed text-blue-50 sm:text-lg">{subtitleHighlight}</p>
        </blockquote>
        <p className="text-base leading-relaxed text-slate-400 sm:text-lg">{subtitleClose}</p>
      </div>
    );
  }

  return (
    <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{hero.subtitle}</p>
  );
}
