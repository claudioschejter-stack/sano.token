import type { Messages } from '../../i18n/locales/en';

type HeroCopy = Messages['landing']['hero'];

const bodyClass =
  'text-base leading-relaxed text-slate-300 md:text-lg lg:mt-4 lg:text-base lg:leading-snug xl:text-lg xl:leading-relaxed';

export function HeroSubtitle({ hero }: { hero: HeroCopy }) {
  return <p className={`mt-4 max-w-2xl sm:mt-5 ${bodyClass}`}>{hero.subtitle}</p>;
}
