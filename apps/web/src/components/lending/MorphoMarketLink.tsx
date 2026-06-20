'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { BASE_CHAIN_ID } from '../../lib/web3/config';

type MorphoMarketLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** Opens Morpho on Base — switches wallet network first when connected on the wrong chain. */
export function MorphoMarketLink({ href, className, children }: MorphoMarketLinkProps) {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();

  const handleClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      if (isConnected && chainId != null && chainId !== BASE_CHAIN_ID && switchChainAsync) {
        try {
          await switchChainAsync({ chainId: BASE_CHAIN_ID });
        } catch {
          /* user may switch manually in wallet extension */
        }
      }

      window.open(href, '_blank', 'noopener,noreferrer');
    },
    [chainId, href, isConnected, switchChainAsync]
  );

  return (
    <a
      href={href}
      onClick={(event) => void handleClick(event)}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={isPending}
    >
      {children}
    </a>
  );
}
