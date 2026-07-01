import { Web3Providers } from '../../components/providers/providers';
import { PortalLayoutClient } from '../../components/layout/PortalLayoutClient';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      <PortalLayoutClient>{children}</PortalLayoutClient>
    </Web3Providers>
  );
}
