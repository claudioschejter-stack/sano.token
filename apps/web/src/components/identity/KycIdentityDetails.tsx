import type { KycIdentitySnapshot } from '../../lib/onboarding/extractDiditIdentity';
import { hasKycIdentityData } from '../../lib/onboarding/extractDiditIdentity';

export type KycIdentityLabels = {
  title: string;
  empty: string;
  fullName: string;
  documentId: string;
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentExpiry: string;
  gender: string;
};

type KycIdentityDetailsProps = {
  identity: KycIdentitySnapshot;
  labels: KycIdentityLabels;
  className?: string;
  variant?: 'card' | 'inline';
};

function IdentityField({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide opacity-70">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

export function KycIdentityDetails({
  identity,
  labels,
  className = '',
  variant = 'card'
}: KycIdentityDetailsProps) {
  const hasData = hasKycIdentityData(identity);

  if (variant === 'inline') {
    if (!hasData) {
      return <p className={`text-xs opacity-70 ${className}`}>{labels.empty}</p>;
    }

    const parts = [
      identity.fullName,
      identity.documentId ? `${labels.documentId}: ${identity.documentId}` : null,
      identity.dateOfBirth ? `${labels.dateOfBirth}: ${identity.dateOfBirth}` : null,
      identity.nationality ? `${labels.nationality}: ${identity.nationality}` : null
    ].filter(Boolean);

    return <p className={`text-xs opacity-80 ${className}`}>{parts.join(' · ')}</p>;
  }

  return (
    <section className={`rounded-xl border p-4 ${className}`}>
      <h3 className="text-sm font-semibold">{labels.title}</h3>

      {!hasData ? (
        <p className="mt-3 text-sm opacity-70">{labels.empty}</p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <IdentityField label={labels.fullName} value={identity.fullName} />
          <IdentityField label={labels.documentId} value={identity.documentId} />
          <IdentityField label={labels.dateOfBirth} value={identity.dateOfBirth} />
          <IdentityField label={labels.nationality} value={identity.nationality} />
          <IdentityField label={labels.documentType} value={identity.documentType} />
          <IdentityField label={labels.documentExpiry} value={identity.documentExpiry} />
          <IdentityField label={labels.gender} value={identity.gender} />
        </dl>
      )}
    </section>
  );
}
