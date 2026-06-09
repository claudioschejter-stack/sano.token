import Link from 'next/link';
import { SanovaLogo } from '../brand/SanovaLogo';

export const portalBrandFrameClass =
  'rounded-xl border border-[#1c2432] bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]';

type PortalBrandFramesProps = {
  portalSubtitle: string;
  href?: string | null;
  onNavigate?: () => void;
  priority?: boolean;
  className?: string;
};

export function PortalBrandFrames({
  portalSubtitle,
  href = '/',
  onNavigate,
  priority = false,
  className = ''
}: PortalBrandFramesProps) {
  const content = (
    <div className={`block w-[13.5rem] space-y-[7mm] ${className}`.trim()}>
      <div
        className={`${portalBrandFrameClass} flex w-full items-center justify-center px-[1mm] py-[2mm]`}
      >
        <SanovaLogo variant="light" showWordmark href={null} className="h-9" priority={priority} />
      </div>
      <div className={`${portalBrandFrameClass} mx-auto w-fit max-w-full px-[2mm] py-[1mm]`}>
        <p className="text-center text-sm font-semibold leading-tight text-black">{portalSubtitle}</p>
      </div>
    </div>
  );

  if (href == null || href === '') {
    return content;
  }

  return (
    <Link href={href} className="block min-w-0 transition-opacity hover:opacity-95" onClick={onNavigate}>
      {content}
    </Link>
  );
}

/** Desktop-proportion brand block scaled for the logged-in mobile header. */
export function PortalBrandFramesMobileHeader({
  portalSubtitle,
  href = '/',
  onNavigate,
  className = ''
}: PortalBrandFramesProps) {
  return (
    <Link
      href={href}
      className={`relative block h-14 w-[7.85rem] shrink-0 overflow-hidden transition-opacity hover:opacity-95 ${className}`.trim()}
      onClick={onNavigate}
      aria-label="Sanova Global"
    >
      <div className="absolute left-0 top-1/2 origin-left -translate-y-1/2 scale-[0.58]">
        <PortalBrandFrames portalSubtitle={portalSubtitle} href={null} className="pointer-events-none" />
      </div>
    </Link>
  );
}
