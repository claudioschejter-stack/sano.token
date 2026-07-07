import { Prisma } from '@sanova/database';

const CLIENT_ERROR_CODES = new Set([
  'EMAIL_IN_USE',
  'WEAK_PASSWORD',
  'INVALID_PHONE',
  'INVALID_EMAIL',
  'INVALID_INPUT',
  'TERMS_NOT_ACCEPTED',
  'INVALID_INVITE_CODE',
  'INVESTOR_ACCESS_NOT_ENABLED',
  'STAFF_INVITE_REQUIRED',
  'CAPTCHA_INVALIDO',
  'REGION_NOT_AVAILABLE',
  'ACCOUNT_STATE_CONFLICT'
]);

function isDatabaseUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('prepared statement') ||
    normalized.includes("can't reach database server") ||
    normalized.includes('connection terminated') ||
    normalized.includes('timeout')
  );
}

function duplicateTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.join(',');
  }
  if (typeof target === 'string') {
    return target;
  }
  return '';
}

export function mapRegisterRouteError(error: unknown): { code: string; status: number } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = duplicateTarget(error);
      if (target.includes('email')) {
        return { code: 'EMAIL_IN_USE', status: 409 };
      }
      return { code: 'ACCOUNT_STATE_CONFLICT', status: 409 };
    }

    if (
      error.code === 'P2024' ||
      error.code === 'P1001' ||
      error.code === 'P1017' ||
      error.code === 'P1008'
    ) {
      return { code: 'DATABASE_UNAVAILABLE', status: 503 };
    }

    return { code: 'REGISTRATION_FAILED', status: 500 };
  }

  if (error instanceof Error) {
    if (CLIENT_ERROR_CODES.has(error.message)) {
      return {
        code: error.message,
        status:
          error.message === 'EMAIL_IN_USE' || error.message === 'ACCOUNT_STATE_CONFLICT'
            ? 409
            : error.message === 'RATE_LIMIT'
              ? 429
              : 400
      };
    }

    if (error.message === 'RATE_LIMIT') {
      return { code: 'RATE_LIMIT', status: 429 };
    }

    if (isDatabaseUnavailableMessage(error.message)) {
      return { code: 'DATABASE_UNAVAILABLE', status: 503 };
    }

    return { code: 'REGISTRATION_FAILED', status: 500 };
  }

  return { code: 'UNKNOWN', status: 500 };
}

export function formatRegistrationAttemptErrorCode(
  error: unknown,
  mappedCode: string
): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = duplicateTarget(error);
    return target ? `${mappedCode}:${error.code}:${target}` : `${mappedCode}:${error.code}`;
  }

  return mappedCode;
}
