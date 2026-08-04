import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSettlementCharges,
  DEFAULT_INVESTOR_GAS_COVERAGE_USD,
  investorGasCoverageUsd
} from './investorGasCoverage';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('investorGasCoverageUsd', () => {
  it('defaults when unset', () => {
    expect(investorGasCoverageUsd()).toBe(DEFAULT_INVESTOR_GAS_COVERAGE_USD);
  });

  it('honours an override', () => {
    vi.stubEnv('RWA_INVESTOR_GAS_COVERAGE_USD', '0.5');
    expect(investorGasCoverageUsd()).toBe(0.5);
  });

  it('ignores blank and invalid values', () => {
    vi.stubEnv('RWA_INVESTOR_GAS_COVERAGE_USD', '');
    expect(investorGasCoverageUsd()).toBe(DEFAULT_INVESTOR_GAS_COVERAGE_USD);
    vi.stubEnv('RWA_INVESTOR_GAS_COVERAGE_USD', 'gratis');
    expect(investorGasCoverageUsd()).toBe(DEFAULT_INVESTOR_GAS_COVERAGE_USD);
    vi.stubEnv('RWA_INVESTOR_GAS_COVERAGE_USD', '-1');
    expect(investorGasCoverageUsd()).toBe(DEFAULT_INVESTOR_GAS_COVERAGE_USD);
  });

  it('allows disabling the coverage', () => {
    vi.stubEnv('RWA_INVESTOR_GAS_COVERAGE_USD', '0');
    expect(investorGasCoverageUsd()).toBe(0);
  });
});

describe('buildSettlementCharges', () => {
  it('defaults the coverage to 0.032 USDC', () => {
    const charges = buildSettlementCharges({ investmentUsd: 20, paymasterFeeUsd: 0 });
    expect(charges.coverageUsd).toBe(0.032);
    expect(charges.treasuryTransferUsd).toBe(20.032);
  });

  it('sends investment plus coverage to treasury', () => {
    const charges = buildSettlementCharges({
      investmentUsd: 20,
      paymasterFeeUsd: 0.004253,
      coverageUsd: 0.032
    });

    expect(charges.treasuryTransferUsd).toBe(20.032);
    expect(charges.networkFeeUsd).toBe(0.036253);
    expect(charges.payableUsdc).toBe(20.036253);
  });

  it('keeps the investment amount untouched', () => {
    const charges = buildSettlementCharges({
      investmentUsd: 20,
      paymasterFeeUsd: 0.01,
      coverageUsd: 0.032
    });
    expect(charges.investmentUsd).toBe(20);
    expect(charges.coverageUsd).toBe(0.032);
  });

  it('falls back to the configured coverage', () => {
    vi.stubEnv('RWA_INVESTOR_GAS_COVERAGE_USD', '0.4');
    const charges = buildSettlementCharges({ investmentUsd: 10, paymasterFeeUsd: 0 });
    expect(charges.coverageUsd).toBe(0.4);
    expect(charges.treasuryTransferUsd).toBe(10.4);
    expect(charges.payableUsdc).toBe(10.4);
  });

  it('never produces negative amounts', () => {
    const charges = buildSettlementCharges({
      investmentUsd: -5,
      paymasterFeeUsd: -1,
      coverageUsd: -2
    });
    expect(charges.investmentUsd).toBe(0);
    expect(charges.paymasterFeeUsd).toBe(0);
    expect(charges.coverageUsd).toBe(0);
    expect(charges.payableUsdc).toBe(0);
  });
});
