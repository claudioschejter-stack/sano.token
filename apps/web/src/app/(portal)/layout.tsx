import type { Metadata } from 'next';
import { Web3Providers } from '../../components/providers/providers';
import { PortalLayoutClient } from '../../components/layout/PortalLayoutClient';
import { OnboardingStatusProvider } from '../../components/providers/OnboardingStatusProvider';

/** Portal routes depend on session, Privy/Wagmi — skip static prerender at build time. */
export const dynamic = 'force-dynamic';

/** Absolute title — avoid root template appending "| Sanova Global" in Custom Tabs. */
export const metadata: Metadata = {
  title: { absolute: 'Sanova' },
  applicationName: 'Sanova',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sanova'
  }
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
