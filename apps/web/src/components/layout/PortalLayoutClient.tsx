'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { PortalMobileNav } from './PortalMobileNav';
import { PortalAccountStatusBar } from '../account/PortalAccountStatusBar';
import { PortalShell } from './PortalShell';
import { PwaShell } from '../pwa/PwaShell';
import { MobileAppDownloadModal } from '../pwa/MobileAppDownloadModal';
import { useMobilePortal } from '../../hooks/useMobilePortal';
import { usePortalInstallGate } from '../../hooks/usePortalInstallGate';

export function PortalLayoutClient({ children }: { children: ReactNode }) {
  const isMobilePortal = useMobilePortal();
  const { shouldGate, markSeenThisSession, acceptInstall } = usePortalInstallGate();

  if (isMobilePortal) {
    return (
      <>
        <MobileAppDownloadModal
          open={shouldGate}
          onClose={markSeenThisSession}
          onContinueWeb={markSeenThisSession}
          onInstallAccepted={acceptInstall}
        />
        <PwaShell>
          <PortalAccountStatusBar />
          <PortalShell>{children}</PortalShell>
        </PwaShell>
      </>
    );
  }

  return (
    <div className="portal-shell flex min-h-dvh min-h-0 flex-col overflow-hidden bg-terminal-bg md:flex-row">
      <AppSidebar />
      <main className="safe-x min-h-0 flex-1 overflow-y-auto bg-terminal-bg px-4 pb-nav-safe pt-[4.5rem] text-terminal-text md:p-8 md:pb-8 md:pt-8">
        <PortalAccountStatusBar />
        <PortalShell>{children}</PortalShell>
      </main>
      <PortalMobileNav />
    </div>
  );
}
