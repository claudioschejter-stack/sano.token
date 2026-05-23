import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

export const marketplaceCtaClassName =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 md:w-auto md:text-sm';

export const platformEntryCtaClassName =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-slate-900 md:w-auto md:text-sm';

type MarketplaceCtaLinkProps = {
  children: ReactNode;
  className?: string;
  showArrow?: boolean;
};

export function MarketplaceCtaLink({
  children,
  className = '',
  showArrow = true
}: MarketplaceCtaLinkProps) {
  return (
    <Link href="/acceso" className={`${marketplaceCtaClassName} ${className}`.trim()}>
      {children}
      {showArrow ? <ArrowRight size={18} aria-hidden /> : null}
    </Link>
  );
}
