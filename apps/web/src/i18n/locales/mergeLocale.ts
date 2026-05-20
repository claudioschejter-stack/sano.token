import type { Messages } from './en';
import { en } from './en';

/** Shallow-merge locale patches onto English defaults (full Messages shape). */
export function mergeLocale(patch: {
  brand?: Partial<Messages['brand']>;
  common?: Partial<Messages['common']>;
  nav?: Partial<Messages['nav']>;
  landing?: Partial<Messages['landing']> & {
    nav?: Partial<Messages['landing']['nav']>;
    hero?: Partial<Messages['landing']['hero']>;
    stats?: Partial<Messages['landing']['stats']>;
    operators?: Partial<Messages['landing']['operators']>;
    howItWorks?: Partial<Messages['landing']['howItWorks']>;
    featured?: Partial<Messages['landing']['featured']>;
    benefits?: Partial<Messages['landing']['benefits']>;
    cta?: Partial<Messages['landing']['cta']>;
    footer?: Partial<Messages['landing']['footer']>;
  };
  access?: Partial<Messages['access']>;
}): Messages {
  const landing = patch.landing;

  return {
    ...en,
    brand: { ...en.brand, ...patch.brand },
    common: { ...en.common, ...patch.common },
    nav: { ...en.nav, ...patch.nav },
    landing: landing
      ? {
          ...en.landing,
          ...landing,
          nav: { ...en.landing.nav, ...landing.nav },
          hero: { ...en.landing.hero, ...landing.hero },
          stats: { ...en.landing.stats, ...landing.stats },
          operators: { ...en.landing.operators, ...landing.operators },
          howItWorks: { ...en.landing.howItWorks, ...landing.howItWorks },
          featured: { ...en.landing.featured, ...landing.featured },
          benefits: { ...en.landing.benefits, ...landing.benefits },
          cta: { ...en.landing.cta, ...landing.cta },
          footer: { ...en.landing.footer, ...landing.footer }
        }
      : en.landing,
    access: { ...en.access, ...patch.access }
  };
}
