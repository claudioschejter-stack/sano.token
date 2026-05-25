import { AppSidebar } from '../../components/layout/AppSidebar';
import { PortalShell } from '../../components/layout/PortalShell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-terminal-bg">
      <AppSidebar />
      <main className="min-h-0 flex-1 overflow-y-auto bg-terminal-bg p-4 text-terminal-text md:p-8">
        <PortalShell>{children}</PortalShell>
      </main>
    </div>
  );
}
