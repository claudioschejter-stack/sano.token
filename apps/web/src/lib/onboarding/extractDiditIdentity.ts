export type DiditIdentityFields = {
  fullName?: string;
  documentId?: string;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstIdVerification(
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

  return {
    ...(fullName ? { fullName } : {}),
    ...(documentId ? { documentId } : {})
  };
}
