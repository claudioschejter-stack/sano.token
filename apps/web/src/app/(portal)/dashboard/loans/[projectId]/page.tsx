'use client';

import { useParams } from 'next/navigation';
import { AdminLaunchEditor } from '../../../../../components/admin/AdminLaunchEditor';

export default function AdminLoanConfigPage() {
  const params = useParams();
  const projectId = typeof params.projectId === 'string' ? params.projectId : '';

  return <AdminLaunchEditor mode="edit" projectId={projectId} scope="lending" />;
}
