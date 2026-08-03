import { describe, expect, it } from 'vitest';
import {
  BASE_CHAIN_ID,
  BASE_USDC_TOKEN_ADDRESS,
  buildCryptoReceiveQrPayload
} from './cryptoReceiveQr';

describe('buildCryptoReceiveQrPayload', () => {
  const receive = '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41';

  it('builds a bare checksummed address for max wallet compatibility', () => {
    const payload = buildCryptoReceiveQrPayload({
      receiveAddress: receive.toLowerCase(),
      amountUsdc: 20.000705,
      mode: 'address'
    });
    expect(payload).toBe(receive);
    expect(payload.startsWith('0x')).toBe(true);
    expect(payload.includes('ethereum:')).toBe(false);
  });

  it('builds EIP-681 USDC transfer URI with Base chain id', () => {
    const payload = buildCryptoReceiveQrPayload({
      receiveAddress: receive,
      amountUsdc: 20,
      mode: 'eip681_usdc'
    });
    expect(payload.startsWith(`ethereum:${BASE_USDC_TOKEN_ADDRESS}@${BASE_CHAIN_ID}/transfer?`)).toBe(
      true
    );
    expect(payload).toContain(`address=${receive}`);
    expect(payload).toContain('uint256=');
  });
});
