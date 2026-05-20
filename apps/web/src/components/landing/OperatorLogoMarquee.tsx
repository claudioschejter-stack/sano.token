'use client';

import Image from 'next/image';

export type MarqueeLogo = {
  src: string;
  alt: string;
  /** Visible label under the logo (defaults to alt). */
  name?: string;
  className?: string;
};

export type OperatorLogoMarqueeProps = {
  logos: MarqueeLogo[];
  /** Full loop duration (both duplicated sets). Default: 72s */
  durationSeconds?: number;
  className?: string;
  ariaLabel?: string;
};

const DEFAULT_LOGO_CLASS =
  'h-9 w-auto max-w-[7.5rem] object-contain sm:h-11 sm:max-w-[8.75rem]';

/**
 * Infinite operator logo marquee (CSS-only animation).
 *
 * @example
 * import { OperatorLogoMarquee } from '@/components/landing/OperatorLogoMarquee';
 *
 * <OperatorLogoMarquee
 *   logos={[
 *     { src: '/logos/operators/ypf.svg', alt: 'YPF' },
 *     { src: '/logos/operators/chevron.png', alt: 'Chevron' },
 *     { src: '/logos/operators/shell.png', alt: 'Shell' },
 *   ]}
 * />
 */
export function OperatorLogoMarquee({
  logos,
  durationSeconds = 72,
  className = '',
  ariaLabel = 'Operadores energéticos en Vaca Muerta'
}: OperatorLogoMarqueeProps) {
  if (logos.length === 0) return null;

  const trackLogos = [...logos, ...logos];

  return (
    <div
      className={`operator-marquee w-full ${className}`.trim()}
      style={{ ['--operator-marquee-duration' as string]: `${durationSeconds}s` }}
      aria-label={ariaLabel}
      role="region"
    >
      <div className="operator-marquee__viewport">
        <ul className="operator-marquee__track" aria-hidden="false">
          {trackLogos.map((logo, index) => {
            const isDuplicate = index >= logos.length;
            const key = `${logo.src}-${index}`;

            const displayName = logo.name ?? logo.alt;

            return (
              <li
                key={key}
                className="operator-marquee__item"
                aria-hidden={isDuplicate}
              >
                <div className="operator-marquee__card">
                  <MarqueeLogoImage
                    src={logo.src}
                    alt={isDuplicate ? '' : logo.alt}
                    className={logo.className ?? DEFAULT_LOGO_CLASS}
                  />
                  <p className="operator-marquee__name" aria-hidden={isDuplicate}>
                    {displayName}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function MarqueeLogoImage({
  src,
  alt,
  className
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const isSvg = src.endsWith('.svg');

  return (
    <Image
      src={src}
      alt={alt}
      width={isSvg ? 140 : 168}
      height={48}
      unoptimized={isSvg}
      className={`operator-marquee__logo ${className}`}
      draggable={false}
    />
  );
}
