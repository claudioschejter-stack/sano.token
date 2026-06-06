import { AppSidebar } from '../../components/layout/AppSidebar';
import { PortalAccountStatusBar } from '../../components/account/PortalAccountStatusBar';
import { PortalShell } from '../../components/layout/PortalShell';
import { Web3Providers } from '../../components/providers/providers';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-terminal-bg md:flex-row">
        <AppSidebar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-terminal-bg px-4 pb-6 pt-[4.5rem] text-terminal-text md:p-8 md:pt-8">
          <PortalAccountStatusBar />
          <PortalShell>{children}</PortalShell>
        </main>
      </div>
    </Web3Providers>
  );
}
