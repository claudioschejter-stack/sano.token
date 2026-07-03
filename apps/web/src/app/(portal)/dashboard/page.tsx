'use client';

import { useSession } from 'next-auth/react';
import { AdminOverview } from '../../../components/admin/AdminOverview';
import { AdvisorDashboardHome } from '../../../components/advisor/AdvisorDashboardHome';
import { ManagerDashboardHome } from '../../../components/advisor/ManagerDashboardHome';
import { FinancialOverview } from '../../../components/dashboard/FinancialOverview';
import { DashboardSkeleton } from '../../../components/dashboard/DashboardSkeleton';
import { PanelInstallAppSection } from '../../../components/pwa/PanelInstallAppSection';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <DashboardSkeleton />;
  }

  const role = session?.user?.role;

  let content;
  if (role === 'ADMIN') {
    content = <AdminOverview />;
  } else if (role === 'ADVISOR_MANAGER') {
    content = <ManagerDashboardHome />;
  } else if (role === 'ADVISOR') {
    content = <AdvisorDashboardHome />;
  } else if (role === 'INVESTOR') {
    content = <FinancialOverview />;
  } else if (role === 'TREASURY' || role === 'OPERATOR') {
    content = <FinancialOverview />;
  } else {
    content = (
      <div className="mx-auto max-w-lg rounded-xl border border-terminal-border bg-terminal-card p-8 text-center text-terminal-muted">
        Panel no disponible para este rol.
      </div>
    );
  }

  return (
    <>
      <PanelInstallAppSection />
      {content}
    </>
  );
}
