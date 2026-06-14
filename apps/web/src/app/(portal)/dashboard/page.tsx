'use client';

import { useSession } from 'next-auth/react';
import { AdminOverview } from '../../../components/admin/AdminOverview';
import { AdvisorDashboardHome } from '../../../components/advisor/AdvisorDashboardHome';
import { ManagerDashboardHome } from '../../../components/advisor/ManagerDashboardHome';
import { FinancialOverview } from '../../../components/dashboard/FinancialOverview';
import { DashboardSkeleton } from '../../../components/dashboard/DashboardSkeleton';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <DashboardSkeleton />;
  }

  const role = session?.user?.role;

  if (role === 'ADMIN') {
    return <AdminOverview />;
  }

  if (role === 'ADVISOR_MANAGER') {
    return <ManagerDashboardHome />;
  }

  if (role === 'ADVISOR') {
    return <AdvisorDashboardHome />;
  }

  if (role === 'INVESTOR') {
    return <FinancialOverview />;
  }

  if (role === 'TREASURY' || role === 'OPERATOR') {
    return <FinancialOverview />;
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-terminal-border bg-terminal-card p-8 text-center text-terminal-muted">
      Panel no disponible para este rol.
    </div>
  );
}
