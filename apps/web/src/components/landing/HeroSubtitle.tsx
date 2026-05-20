import type { Messages } from '../../i18n/locales/en';

type HeroCopy = Messages['landing']['hero'];

const bodyClass = 'text-base leading-relaxed text-slate-300 sm:text-lg';

export function HeroSubtitle({ hero }: { hero: HeroCopy }) {
  return <p className={`mt-6 max-w-2xl ${bodyClass}`}>{hero.subtitle}</p>;
}
