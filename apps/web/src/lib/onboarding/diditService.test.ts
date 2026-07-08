import { describe, expect, it } from 'vitest';
import { diditErrorI18nKey, parseDiditSessionError } from './diditService';

describe('parseDiditSessionError', () => {
  it('maps auth failures to DIDIT_AUTH_FAILED', () => {
    const parsed = parseDiditSessionError('DIDIT_SESSION_FAILED:401:{"detail":"Invalid API key"}');
    expect(parsed.httpStatus).toBe(401);
    expect(parsed.diditMessage).toBe('Invalid API key');
    expect(diditErrorI18nKey(parsed)).toBe('DIDIT_AUTH_FAILED');
  });

  it('maps missing workflow to DIDIT_WORKFLOW_NOT_FOUND', () => {
    const parsed = parseDiditSessionError('DIDIT_SESSION_FAILED:404:Workflow not found');
    expect(diditErrorI18nKey(parsed)).toBe('DIDIT_WORKFLOW_NOT_FOUND');
  });

  it('maps quota errors to DIDIT_QUOTA_EXCEEDED', () => {
    const parsed = parseDiditSessionError('DIDIT_SESSION_FAILED:402:Quota exceeded');
    expect(diditErrorI18nKey(parsed)).toBe('DIDIT_QUOTA_EXCEEDED');
  });

  it('maps zero-credit 400 responses to DIDIT_QUOTA_EXCEEDED', () => {
    const parsed = parseDiditSessionError(
      'DIDIT_SESSION_FAILED:400:{"detail":"You don\'t have enough credits to perform this request. Please top up at https://business.didit.me"}'
    );
    expect(diditErrorI18nKey(parsed)).toBe('DIDIT_QUOTA_EXCEEDED');
  });

  it('handles static Didit codes', () => {
    expect(parseDiditSessionError('DIDIT_NOT_CONFIGURED').code).toBe('DIDIT_NOT_CONFIGURED');
    expect(parseDiditSessionError('DIDIT_SESSION_INVALID_RESPONSE').code).toBe(
      'DIDIT_SESSION_INVALID_RESPONSE'
    );
  });
});
