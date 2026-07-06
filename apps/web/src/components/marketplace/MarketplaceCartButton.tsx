'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { getMarketplaceCapabilities } from '../../lib/marketplace/marketplaceCapabilities';
import { useCartStore } from '../../store/useCartStore';

type MarketplaceCartButtonProps = {
  className?: string;
};

export function MarketplaceCartButton({ className = '' }: MarketplaceCartButtonProps) {
  const { data: session } = useSession();
  const t = useTranslation();
  const { isOperational } = useAccountStatus();
  const cartItemCount = useCartStore((state) => state.itemCount());
  const role = session?.user?.role;
  const capabilities = getMarketplaceCapabilities(role);

  if (!session?.user || !capabilities.showPurchaseActions || !isOperational) {
    return null;
  }

  return (
    <Link
      href="/marketplace/carrito"
      aria-label={t.cartCheckout.viewCart}
      className={`marketplace-cart-blink relative inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-1.5 text-xs font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/20 ${className}`.trim()}
    >
      <ShoppingCart size={16} />
      <span>{t.cartCheckout.viewCart}</span>
      {cartItemCount > 0 ? (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-terminal-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
          {cartItemCount}
        </span>
      ) : null}
    </Link>
  );
}
