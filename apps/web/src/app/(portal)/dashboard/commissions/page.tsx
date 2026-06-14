'use client';

import { useSession } from 'next-auth/react';
import { AdminCommissionsView } from '../../../../components/admin/AdminCommissionsView';
import { AdvisorCommissionsView } from '../../../../components/advisor/AdvisorCommissionsView';

export default function CommissionsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (role === 'ADMIN') {
    return <AdminCommissionsView />;
  }

  return <AdvisorCommissionsView />;
}
