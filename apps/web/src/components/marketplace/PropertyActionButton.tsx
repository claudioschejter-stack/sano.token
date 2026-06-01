import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type PropertyActionVariant = 'rent' | 'sell' | 'loan' | 'soldOut' | 'kyc' | 'staff';

export const propertyActionButtonBase =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition sm:text-sm';

const variantClasses: Record<PropertyActionVariant, string> = {
  rent: 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400',
  staff: 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400',
  sell: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400',
  loan: 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-400',
  soldOut:
    'cursor-default bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-pink-500/30',
  kyc: 'border-2 border-amber-400/70 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
};

export function propertyActionButtonClass(variant: PropertyActionVariant, extra = ''): string {
  return `${propertyActionButtonBase} ${variantClasses[variant]} ${extra}`.trim();
}

type PropertyActionButtonProps = {
  variant: PropertyActionVariant;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
} & (
  | ({ href: string } & Omit<ComponentPropsWithoutRef<typeof Link>, 'href' | 'className' | 'children'>)
  | ({ href?: undefined } & Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children' | 'type'>)
);

export function PropertyActionButton({
  variant,
  children,
  className = '',
  disabled,
  href,
  ...rest
}: PropertyActionButtonProps) {
  const classes = propertyActionButtonClass(variant, className);

  if (href) {
    return (
      <Link href={href} className={classes} {...(rest as ComponentPropsWithoutRef<typeof Link>)}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || variant === 'soldOut'}
      aria-disabled={disabled || variant === 'soldOut' ? true : undefined}
      className={`${classes}${disabled ? ' cursor-not-allowed opacity-50' : ''}`}
      {...(rest as ComponentPropsWithoutRef<'button'>)}
    >
      {children}
    </button>
  );
}
