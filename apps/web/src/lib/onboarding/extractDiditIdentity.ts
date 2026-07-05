export type DiditIdentityFields = {
  fullName?: string;
  documentId?: string;
  dateOfBirth?: string;
  nationality?: string;
  documentType?: string;
  documentExpiry?: string;
  gender?: string;
  personalNumber?: string;
  issuingState?: string;
};

export type KycIdentitySnapshot = {
  fullName: string | null;
  documentId: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  documentType: string | null;
  documentExpiry: string | null;
  gender: string | null;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function firstIdVerification(
  payload: Record<string, unknown>
): Record<string, unknown> | undefined {
  const decision = payload.decision as Record<string, unknown> | undefined;
  const fromDecision = decision?.id_verifications ?? decision?.idVerifications;
  const topLevel = payload.id_verifications ?? payload.idVerifications;
  const list = (fromDecision ?? topLevel) as unknown;

  if (!Array.isArray(list) || list.length === 0) {
    return undefined;
  }

  return list[0] as Record<string, unknown>;
}

/** Parses Didit webhook v3 `decision.id_verifications` into stored user fields. */
export function extractDiditIdentity(payload: Record<string, unknown>): DiditIdentityFields {
  const verification = firstIdVerification(payload);

  if (!verification) {
    return {};
  }

  const documentId = readString(verification.document_number ?? verification.documentNumber);
  const firstName = readString(verification.first_name ?? verification.firstName);
  const lastName = readString(verification.last_name ?? verification.lastName);
  const fullNameFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
  const fullName =
    readString(verification.full_name ?? verification.fullName) ??
    (fullNameFromParts || undefined);

  const nationality =
    readString(verification.nationality) ??
    readString(verification.issuing_state ?? verification.issuingState) ??
    readString(verification.country);

  return {
    ...(fullName ? { fullName } : {}),
    ...(documentId ? { documentId } : {}),
    ...(readString(verification.date_of_birth ?? verification.dateOfBirth)
      ? { dateOfBirth: readString(verification.date_of_birth ?? verification.dateOfBirth) }
      : {}),
    ...(nationality ? { nationality } : {}),
    ...(readString(verification.document_type ?? verification.documentType)
      ? { documentType: readString(verification.document_type ?? verification.documentType) }
      : {}),
    ...(readString(
      verification.expiration_date ??
        verification.expirationDate ??
        verification.expiry_date ??
        verification.expiryDate
    )
      ? {
          documentExpiry: readString(
            verification.expiration_date ??
              verification.expirationDate ??
              verification.expiry_date ??
              verification.expiryDate
          )
        }
      : {}),
    ...(readString(verification.gender ?? verification.sex)
      ? { gender: readString(verification.gender ?? verification.sex) }
      : {}),
    ...(readString(verification.personal_number ?? verification.personalNumber)
      ? { personalNumber: readString(verification.personal_number ?? verification.personalNumber) }
      : {}),
    ...(readString(verification.issuing_state ?? verification.issuingState)
      ? { issuingState: readString(verification.issuing_state ?? verification.issuingState) }
      : {})
  };
}

export function buildDiditIdentityUpdate(identity: DiditIdentityFields) {
  return {
    ...(identity.fullName ? { kycFullName: identity.fullName, name: identity.fullName } : {}),
    ...(identity.documentId ? { kycDocumentId: identity.documentId } : {}),
    ...(identity.dateOfBirth ? { kycDateOfBirth: identity.dateOfBirth } : {}),
    ...(identity.nationality
      ? { kycNationality: identity.nationality, jurisdiction: identity.nationality }
      : {}),
    ...(identity.documentType ? { kycDocumentType: identity.documentType } : {}),
    ...(identity.documentExpiry ? { kycDocumentExpiry: identity.documentExpiry } : {}),
    ...(identity.gender ? { kycGender: identity.gender } : {})
  };
}

type UserKycSource = {
  name: string | null;
  kycFullName: string | null;
  kycDocumentId: string | null;
  kycDateOfBirth: string | null;
  kycNationality: string | null;
  kycDocumentType: string | null;
  kycDocumentExpiry: string | null;
  kycGender: string | null;
  jurisdiction: string | null;
};

export function buildKycIdentitySnapshot(user: UserKycSource): KycIdentitySnapshot {
  return {
    fullName: user.kycFullName ?? user.name,
    documentId: user.kycDocumentId,
    dateOfBirth: user.kycDateOfBirth,
    nationality: user.kycNationality ?? user.jurisdiction,
    documentType: user.kycDocumentType,
    documentExpiry: user.kycDocumentExpiry,
    gender: user.kycGender
  };
}

export function hasKycIdentityData(identity: KycIdentitySnapshot): boolean {
  return Object.values(identity).some((value) => Boolean(value?.trim()));
}
