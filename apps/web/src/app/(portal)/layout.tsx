import type { Metadata } from 'next';
import { Web3Providers } from '../../components/providers/providers';
import { PortalLayoutClient } from '../../components/layout/PortalLayoutClient';
import { OnboardingStatusProvider } from '../../components/providers/OnboardingStatusProvider';

/** Portal routes depend on session, Privy/Wagmi — skip static prerender at build time. */
export const dynamic = 'force-dynamic';

/** Short title so browser chrome (if any) shows "Sanova", not the marketing SEO string. */
export const metadata: Metadata = {
  title: 'Sanova',
  applicationName: 'Sanova'
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      <OnboardingStatusProvider>
        <PortalLayoutClient>{children}</PortalLayoutClient>
      </OnboardingStatusProvider>
    </Web3Providers>
  );
}
