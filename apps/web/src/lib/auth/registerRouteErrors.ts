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
  'REGION_NOT_AVAILABLE'
]);

export function mapRegisterRouteError(error: unknown): { code: string; status: number } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.includes('email')) {
        return { code: 'EMAIL_IN_USE', status: 409 };
      }
      return { code: 'REGISTRATION_FAILED', status: 409 };
    }

    if (error.code === 'P2024' || error.code === 'P1001' || error.code === 'P1017') {
      return { code: 'DATABASE_UNAVAILABLE', status: 503 };
    }

    return { code: 'REGISTRATION_FAILED', status: 500 };
  }

  if (error instanceof Error) {
    if (CLIENT_ERROR_CODES.has(error.message)) {
      return {
        code: error.message,
        status:
          error.message === 'EMAIL_IN_USE'
            ? 409
            : error.message === 'RATE_LIMIT'
              ? 429
              : 400
      };
    }

    if (error.message === 'RATE_LIMIT') {
      return { code: 'RATE_LIMIT', status: 429 };
    }

    return { code: 'REGISTRATION_FAILED', status: 500 };
  }

  return { code: 'UNKNOWN', status: 500 };
}
