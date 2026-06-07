import Image from 'next/image';
import Link from 'next/link';

type SanovaLogoProps = {
  variant?: 'light' | 'dark' | 'mark';
  href?: string | null;
  className?: string;
  showWordmark?: boolean;
  priority?: boolean;
  onClick?: () => void;
};

const markAsset = {
  src: '/brand/logo-sanova.png',
  width: 1024,
  height: 1024,
  alt: 'Sanova Global'
} as const;

const wordmarkTone = {
  light: {
    primary: 'text-slate-900',
    secondary: 'text-slate-500'
  },
  dark: {
    primary: 'text-white',
    secondary: 'text-slate-300'
  }
} as const;

function LogoWordmark({ variant }: { variant: 'light' | 'dark' }) {
  const tone = wordmarkTone[variant];

  return (
    <span className="flex min-w-0 flex-col justify-center leading-none">
      <span
        className={`truncate text-[0.68rem] font-bold uppercase tracking-[0.14em] sm:text-xs md:text-sm ${tone.primary}`}
      >
        SANOVA GLOBAL
      </span>
      <span
        className={`mt-1 text-[0.58rem] font-semibold tracking-[0.38em] sm:text-[0.62rem] md:text-[0.65rem] ${tone.secondary}`}
      >
        RWA
      </span>
    </span>
  );
}

export function SanovaLogo({
  variant = 'light',
  href,
  className = '',
  showWordmark = true,
  priority = false,
  onClick
}: SanovaLogoProps) {
  const iconOnly = variant === 'mark' || !showWordmark;
  const wordmarkVariant = variant === 'dark' ? 'dark' : 'light';

  const content = (
    <span
      className={`inline-flex min-w-0 items-center gap-2 sm:gap-2.5 ${iconOnly ? '' : 'pr-0.5'} ${className}`.trim()}
    >
      <Image
        src={markAsset.src}
        alt={markAsset.alt}
        width={markAsset.width}
        height={markAsset.height}
        className={
          iconOnly
            ? 'h-8 w-8 shrink-0 sm:h-9 sm:w-9'
            : 'h-9 w-9 shrink-0 sm:h-10 sm:w-10 md:h-11 md:w-11'
        }
        priority={priority}
      />
      {!iconOnly ? <LogoWordmark variant={wordmarkVariant} /> : null}
    </span>
  );

  if (href == null || href === '') {
    return content;
  }

  return (
    <Link
      href={href}
      className="inline-flex min-w-0 shrink-0 items-center"
      aria-label={markAsset.alt}
      onClick={onClick}
    >
      {content}
    </Link>
  );
}
