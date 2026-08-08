import { afterEach, describe, expect, it, vi } from 'vitest';
import { isArsFxRateConfigured, resolveArsPerUsd } from './arsFxRate';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveArsPerUsd', () => {
  it('prefers a rail-specific rate, so a rail can carry its own spread', () => {
    vi.stubEnv('MACRO_CLICK_FX_ARS', '1200');
    vi.stubEnv('FX_ARS', '1100');
    expect(resolveArsPerUsd('MACRO_CLICK_FX_ARS')).toBe(1200);
  });

  it('uses the shared rate when the rail has none', () => {
    vi.stubEnv('FX_ARS', '1100');
    expect(resolveArsPerUsd('MACRO_CLICK_FX_ARS')).toBe(1100);
  });

  it('keeps honouring the legacy name, so removing it cannot change a price', () => {
    vi.stubEnv('RIPIO_FX_ARS', '1300');
    expect(resolveArsPerUsd()).toBe(1300);
  });

  it('ignores a var that is present but empty, which used to yield NaN', () => {
    vi.stubEnv('FX_ARS', '');
    vi.stubEnv('RIPIO_FX_ARS', '1150');
    expect(resolveArsPerUsd()).toBe(1150);
  });

  it('ignores a non-numeric or negative rate instead of charging it', () => {
    vi.stubEnv('FX_ARS', 'mil');
    expect(resolveArsPerUsd()).toBe(1050);

    vi.unstubAllEnvs();
    vi.stubEnv('FX_ARS', '-500');
    expect(resolveArsPerUsd()).toBe(1050);
  });

  it('falls back to a default rather than charging zero', () => {
    expect(resolveArsPerUsd()).toBe(1050);
  });
});

describe('isArsFxRateConfigured', () => {
  it('tells a default apart from a configured rate', () => {
    expect(isArsFxRateConfigured()).toBe(false);
    vi.stubEnv('FX_ARS', '1100');
    expect(isArsFxRateConfigured()).toBe(true);
  });
});
