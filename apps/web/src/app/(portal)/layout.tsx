import { AppSidebar } from '../../components/layout/AppSidebar';
import { PortalMobileNav } from '../../components/layout/PortalMobileNav';
import { PortalAccountStatusBar } from '../../components/account/PortalAccountStatusBar';
import { PortalShell } from '../../components/layout/PortalShell';
import { InstallAppBanner } from '../../components/pwa/InstallAppBanner';
import { Web3Providers } from '../../components/providers/providers';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      <div className="flex min-h-dvh min-h-0 flex-col overflow-hidden bg-terminal-bg md:flex-row">
        <AppSidebar />
        <main className="safe-x min-h-0 flex-1 overflow-y-auto bg-terminal-bg px-4 pb-nav-safe pt-[4.5rem] text-terminal-text md:p-8 md:pb-8 md:pt-8">
          <InstallAppBanner />
          <PortalAccountStatusBar />
          <PortalShell>{children}</PortalShell>
        </main>
        <PortalMobileNav />
      </div>
    </Web3Providers>
  );
}
