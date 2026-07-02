import { Web3Providers } from '../../components/providers/providers';
import { PortalLayoutClient } from '../../components/layout/PortalLayoutClient';

/** Portal routes depend on session, Privy/Wagmi — skip static prerender at build time. */
export const dynamic = 'force-dynamic';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      <PortalLayoutClient>{children}</PortalLayoutClient>
    </Web3Providers>
  );
}
