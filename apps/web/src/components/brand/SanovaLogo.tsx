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

/** Raster app button — single source asset at max quality. */
const asset = {
  src: '/brand/sanova-app-button-1024.png',
  width: 1024,
  height: 1024,
  alt: 'Sanova'
} as const;

export function SanovaLogo({
  href,
  className = '',
  priority = false,
  onClick
}: SanovaLogoProps) {
  const image = (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      className={`h-9 w-9 shrink-0 sm:h-10 sm:w-10 ${className}`.trim()}
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
