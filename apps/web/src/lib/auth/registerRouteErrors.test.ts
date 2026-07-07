import { describe, expect, it } from 'vitest';
import { Prisma } from '@sanova/database';
import {
  formatRegistrationAttemptErrorCode,
  mapRegisterRouteError
} from './registerRouteErrors';

describe('mapRegisterRouteError', () => {
  it('maps duplicate email constraint to EMAIL_IN_USE', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] }
    });

    expect(mapRegisterRouteError(error)).toEqual({ code: 'EMAIL_IN_USE', status: 409 });
  });

  it('maps duplicate wallet constraint to ACCOUNT_STATE_CONFLICT', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['walletAddress'] }
    });

    expect(mapRegisterRouteError(error)).toEqual({ code: 'ACCOUNT_STATE_CONFLICT', status: 409 });
  });

  it('maps known business errors to 400', () => {
    expect(mapRegisterRouteError(new Error('WEAK_PASSWORD'))).toEqual({
      code: 'WEAK_PASSWORD',
      status: 400
    });
  });

  it('maps prepared statement pool errors to DATABASE_UNAVAILABLE', () => {
    expect(mapRegisterRouteError(new Error('prepared statement already exists'))).toEqual({
      code: 'DATABASE_UNAVAILABLE',
      status: 503
    });
  });

  it('maps unknown errors to REGISTRATION_FAILED', () => {
    expect(mapRegisterRouteError(new Error('unexpected'))).toEqual({
      code: 'REGISTRATION_FAILED',
      status: 500
    });
  });
});

describe('formatRegistrationAttemptErrorCode', () => {
  it('includes prisma code and target in attempt error code', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['walletAddress'] }
    });

    expect(formatRegistrationAttemptErrorCode(error, 'ACCOUNT_STATE_CONFLICT')).toBe(
      'ACCOUNT_STATE_CONFLICT:P2002:walletAddress'
    );
  });
});
