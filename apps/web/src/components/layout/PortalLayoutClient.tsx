'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { PortalMobileNav } from './PortalMobileNav';
import { PortalAccountStatusBar } from '../account/PortalAccountStatusBar';
import { PortalShell } from './PortalShell';
import { InstallAppBanner } from '../pwa/InstallAppBanner';
import { PwaShell } from '../pwa/PwaShell';
import { PostLoginInstallModal } from '../pwa/PostLoginInstallModal';
import { PasskeyRegisterModal } from '../auth/PasskeyRegisterModal';
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
        <PasskeyRegisterModal />
      </>
    );
  }

  return (
    <div className="portal-shell flex min-h-dvh min-h-0 flex-col overflow-hidden bg-terminal-bg md:flex-row">
      <AppSidebar />
      <main className="safe-x min-h-0 flex-1 overflow-y-auto bg-terminal-bg px-4 pb-nav-safe pt-[4.5rem] text-terminal-text md:p-8 md:pb-8 md:pt-8">
        <InstallAppBanner />
        <PortalAccountStatusBar />
        <PortalShell>{children}</PortalShell>
      </main>
      <PortalMobileNav />
      <PasskeyRegisterModal />
      <PostLoginInstallModal />
    </div>
  );
}
