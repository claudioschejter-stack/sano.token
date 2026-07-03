'use client';

import { InstallAppBanner } from './InstallAppBanner';

/** App install prompt — only shown inside Panel de control (/dashboard). */
export function PanelInstallAppSection() {
  return (
    <section aria-label="Instalar aplicación" className="mb-6">
      <InstallAppBanner />
    </section>
  );
}
