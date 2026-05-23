'use client';

import { useParams } from 'next/navigation';
import { AdminLaunchEditor } from '../../../../../../components/admin/AdminLaunchEditor';

export default function EditLaunchPage() {
  const params = useParams<{ projectId: string }>();
  return <AdminLaunchEditor mode="edit" projectId={params.projectId} />;
}
