import { describe, expect, it } from 'vitest';
import { AbiCoder, keccak256 } from 'ethers';
import { dailyWithdrawalLimitActionId, nextTimelockMove } from './repairRwaSecurityConfig';

const NOW = 1_760_000_000;

describe('nextTimelockMove', () => {
  it('does nothing when the chain already holds the value', () => {
    expect(nextTimelockMove({ satisfied: true, inSetupWindow: false, readyAt: null }, NOW)).toBe('SKIP');
  });

  it('applies directly inside the setup window, where the contract skips the timelock', () => {
    expect(nextTimelockMove({ satisfied: false, inSetupWindow: true, readyAt: null }, NOW)).toBe(
      'EXECUTE'
    );
  });

  it('starts the clock when the action was never scheduled', () => {
    expect(nextTimelockMove({ satisfied: false, inSetupWindow: false, readyAt: null }, NOW)).toBe(
      'SCHEDULE'
    );
  });

  it('waits instead of calling a setter that would revert', () => {
    expect(
      nextTimelockMove({ satisfied: false, inSetupWindow: false, readyAt: NOW + 3600 }, NOW)
    ).toBe('WAIT');
  });

  it('applies once the scheduled time has passed', () => {
    expect(nextTimelockMove({ satisfied: false, inSetupWindow: false, readyAt: NOW - 1 }, NOW)).toBe(
      'EXECUTE'
    );
  });

  it('treats the exact ready second as applicable, like the contract does', () => {
    expect(nextTimelockMove({ satisfied: false, inSetupWindow: false, readyAt: NOW }, NOW)).toBe(
      'EXECUTE'
    );
  });
});

describe('dailyWithdrawalLimitActionId', () => {
  it('matches the vault keccak256(abi.encode("SET_DAILY_WITHDRAWAL_LIMIT", limit))', () => {
    const limit = 500n * 10n ** 18n;
    const expected = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['string', 'uint256'],
        ['SET_DAILY_WITHDRAWAL_LIMIT', limit]
      )
    );
    expect(dailyWithdrawalLimitActionId(limit)).toBe(expected);
  });

  it('changes with the amount, which is why a target has to be pinned', () => {
    expect(dailyWithdrawalLimitActionId(1n)).not.toBe(dailyWithdrawalLimitActionId(2n));
  });
});
