import { Prisma } from '@sanova/database';
import { describe, expect, it } from 'vitest';
import { mapRegisterRouteError } from './registerRouteErrors';

describe('mapRegisterRouteError', () => {
  it('maps duplicate email constraint to EMAIL_IN_USE', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] }
    });

    expect(mapRegisterRouteError(error)).toEqual({ code: 'EMAIL_IN_USE', status: 409 });
  });

  it('maps known business errors to 400', () => {
    expect(mapRegisterRouteError(new Error('WEAK_PASSWORD'))).toEqual({
      code: 'WEAK_PASSWORD',
      status: 400
    });
  });

  it('maps unknown errors to REGISTRATION_FAILED', () => {
    expect(mapRegisterRouteError(new Error('prepared statement already exists'))).toEqual({
      code: 'REGISTRATION_FAILED',
      status: 500
    });
  });
});
