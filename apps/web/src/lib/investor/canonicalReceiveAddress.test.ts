import { describe, expect, it } from 'vitest';
import { isReceiveAddressDrift, resolveDisplayReceiveAddress } from './canonicalReceiveAddress';

describe('canonical receive address invariant', () => {
  it('never shows the Privy client address when server linked is missing', () => {
    expect(
      resolveDisplayReceiveAddress({
        serverLinkedAddress: null,
        privyClientAddress: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41'
      })
    ).toBeNull();
  });

  it('always prefers the server-linked address over Privy client', () => {
    expect(
      resolveDisplayReceiveAddress({
        serverLinkedAddress: '0xb3116d28d070b5bab56221b2882dce663699cc76',
        privyClientAddress: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41'
      })
    ).toBe('0xb3116d28d070b5bab56221b2882dce663699cc76');
  });

  it('detects client/server drift', () => {
    expect(
      isReceiveAddressDrift({
        serverLinkedAddress: '0xb3116d28d070b5bab56221b2882dce663699cc76',
        privyClientAddress: '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41'
      })
    ).toBe(true);
  });
});
