'use client';

import { useParams } from 'next/navigation';
import { AdminProjectOperatingPanel } from '../../../../../components/admin/AdminProjectOperatingPanel';

export default function AdminProjectRentPage() {
  const params = useParams();
  const projectId = typeof params.projectId === 'string' ? params.projectId : '';

  if (!projectId) {
    return null;
  }

  return <AdminProjectOperatingPanel projectId={projectId} />;
}
