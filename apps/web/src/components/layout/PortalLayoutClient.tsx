'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { PortalMobileNav } from './PortalMobileNav';
import { PortalAccountStatusBar } from '../account/PortalAccountStatusBar';
import { PortalShell } from './PortalShell';
import { PwaShell } from '../pwa/PwaShell';
import { useMobilePortal } from '../../hooks/useMobilePortal';

export function PortalLayoutClient({ children }: { children: ReactNode }) {
  const isMobilePortal = useMobilePortal();

  if (isMobilePortal) {
    return (
      <>
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
