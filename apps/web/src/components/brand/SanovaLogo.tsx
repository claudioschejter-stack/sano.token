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

const assets = {
  light: { src: '/brand/sanova-logo.svg', width: 220, height: 40, alt: 'Sanova Global' },
  dark: { src: '/brand/sanova-logo-dark.svg', width: 220, height: 40, alt: 'Sanova Global' },
  mark: { src: '/brand/sanova-isotipo.svg', width: 40, height: 40, alt: 'Sanova' }
} as const;

export function SanovaLogo({
  variant = 'light',
  href,
  className = '',
  showWordmark = true,
  priority = false,
  onClick
}: SanovaLogoProps) {
  const resolvedVariant = variant === 'mark' || !showWordmark ? 'mark' : variant;
  const asset = resolvedVariant === 'mark' ? assets.mark : assets[resolvedVariant];

  const image = (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      className={`h-8 w-auto sm:h-9 ${className}`.trim()}
      priority={priority}
    />
  );

  if (href == null || href === '') {
    return image;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center"
      aria-label={asset.alt}
      onClick={onClick}
    >
      {image}
    </Link>
  );
}
