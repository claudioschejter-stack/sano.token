'use client';

import { useSession } from 'next-auth/react';
import { AdminTeamView } from '../../../../components/admin/AdminTeamView';
import { AdvisorTeamView } from '../../../../components/advisor/AdvisorTeamView';

export default function TeamPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (role === 'ADMIN') {
    return <AdminTeamView />;
  }

  return <AdvisorTeamView />;
}
