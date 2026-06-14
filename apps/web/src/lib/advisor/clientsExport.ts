import type { AdvisorClientRecord } from './clientsService';

export function buildClientsCsv(clients: AdvisorClientRecord[]): string {
  const header = [
    'email',
    'name',
    'kyc_status',
    'incorporated_at',
    'incorporated_by_email',
    'registered_at'
  ].join(',');

  const lines = clients.map((row) => {
    const name = row.investor?.fullName ?? row.name ?? '';
    return [
      row.email,
      name,
      row.kycStatus,
      row.incorporatedAt ?? '',
      row.incorporatedByEmail ?? '',
      row.createdAt
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',');
  });

  return [header, ...lines].join('\n');
}
