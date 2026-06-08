import type { Messages } from '../../i18n/locales/en';

type HeroCopy = Messages['landing']['hero'];

const bodyClass =
  'text-base leading-relaxed text-slate-300 md:text-lg lg:mt-4 lg:text-base lg:leading-snug xl:text-lg xl:leading-relaxed';

type HeroSubtitleProps = {
  hero: HeroCopy;
  className?: string;
  part?: 'full' | 'lead' | 'tail';
};

export function HeroSubtitle({ hero, className = '', part = 'full' }: HeroSubtitleProps) {
  const text =
    part === 'lead'
      ? hero.subtitleLead
      : part === 'tail'
        ? hero.subtitleTail
        : hero.subtitle;

  return <p className={`mt-4 max-w-2xl sm:mt-5 ${bodyClass} ${className}`.trim()}>{text}</p>;
}
