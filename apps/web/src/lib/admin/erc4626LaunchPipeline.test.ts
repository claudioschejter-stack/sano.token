import { describe, expect, it, afterEach } from 'vitest';
import { ERC4626_LAUNCH_PIPELINE, shouldUseAsyncErc4626Deploy } from './erc4626LaunchPipeline';

describe('erc4626LaunchPipeline', () => {
  const original = process.env.AUTOMATION_ASYNC_DEPLOY;

  afterEach(() => {
    process.env.AUTOMATION_ASYNC_DEPLOY = original;
  });

  it('enables async deploy by default', () => {
    delete process.env.AUTOMATION_ASYNC_DEPLOY;
    expect(shouldUseAsyncErc4626Deploy()).toBe(true);
  });

  it('disables async deploy when AUTOMATION_ASYNC_DEPLOY=false', () => {
    process.env.AUTOMATION_ASYNC_DEPLOY = 'false';
    expect(shouldUseAsyncErc4626Deploy()).toBe(false);
  });

  it('exports stable pipeline id', () => {
    expect(ERC4626_LAUNCH_PIPELINE).toBe('ERC4626_LAUNCH');
  });
});
