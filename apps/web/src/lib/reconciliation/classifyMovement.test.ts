import { describe, expect, it } from 'vitest';
import { ZeroAddress } from 'ethers';
import { attributeMovement, classifyMovement, classifyShareMovement } from './classifyMovement';

const WALLET = '0x1234567890123456789012345678901234567890';

describe('classifyMovement', () => {
  it('reads investor to treasury as a purchase', () => {
    expect(
      classifyMovement({ asset: 'USDC', fromRole: 'investor', toRole: 'stablecoin_treasury' })
    ).toBe('USDC_PAYMENT');
  });

  it('reads treasury to investor as a distribution, not a purchase', () => {
    expect(
      classifyMovement({ asset: 'USDC', fromRole: 'stablecoin_treasury', toRole: 'investor' })
    ).toBe('USDC_RENT_PAYOUT');
  });

  it('names the four Morpho directions', () => {
    expect(
      classifyMovement({ asset: 'USDC', fromRole: 'morpho_liquidity', toRole: 'morpho' })
    ).toBe('MORPHO_SUPPLY');
    expect(
      classifyMovement({ asset: 'USDC', fromRole: 'morpho', toRole: 'morpho_liquidity' })
    ).toBe('MORPHO_WITHDRAW');
    expect(classifyMovement({ asset: 'USDC', fromRole: 'morpho', toRole: 'investor' })).toBe(
      'MORPHO_BORROW'
    );
    expect(classifyMovement({ asset: 'USDC', fromRole: 'investor', toRole: 'morpho' })).toBe(
      'MORPHO_REPAY'
    );
  });

  it('separates internal treasury movements from investor payments', () => {
    expect(
      classifyMovement({ asset: 'USDC', fromRole: 'token_treasury', toRole: 'morpho_liquidity' })
    ).toBe('USDC_TREASURY_TRANSFER');
  });

  it('falls back to a payment when neither side is known', () => {
    expect(classifyMovement({ asset: 'USDC', fromRole: null, toRole: null })).toBe('USDC_PAYMENT');
  });
});

describe('classifyShareMovement', () => {
  it('recognises a mint by the zero address', () => {
    expect(
      classifyShareMovement({
        fromAddress: ZeroAddress,
        toAddress: WALLET,
        fromRole: null,
        toRole: 'token_treasury'
      })
    ).toBe('RWA_SHARE_MINT');
  });

  it('recognises a burn by the zero address', () => {
    expect(
      classifyShareMovement({
        fromAddress: WALLET,
        toAddress: ZeroAddress,
        fromRole: 'investor',
        toRole: null
      })
    ).toBe('RWA_SHARE_BURN');
  });

  it('marks shares reaching an investor as a delivery', () => {
    expect(
      classifyShareMovement({
        fromAddress: WALLET,
        toAddress: WALLET,
        fromRole: 'token_treasury',
        toRole: 'investor'
      })
    ).toBe('RWA_SHARE_DELIVERY');
  });

  it('marks anything the delivery module moved as a delivery', () => {
    expect(
      classifyShareMovement({
        fromAddress: WALLET,
        toAddress: WALLET,
        fromRole: 'delivery_module',
        toRole: null
      })
    ).toBe('RWA_SHARE_DELIVERY');
  });

  it('leaves a transfer between two platform wallets as a plain transfer', () => {
    expect(
      classifyShareMovement({
        fromAddress: WALLET,
        toAddress: WALLET,
        fromRole: 'rwa_operator',
        toRole: 'token_treasury'
      })
    ).toBe('RWA_SHARE_TRANSFER');
  });
});

describe('attributeMovement', () => {
  it('attributes to the investor side, whichever it is', () => {
    const investor = { address: WALLET, role: 'investor' as const, userId: 'u1', investorId: 'i1' };
    const treasury = { address: WALLET, role: 'stablecoin_treasury' as const };

    expect(attributeMovement(treasury, investor)).toEqual({ userId: 'u1', investorId: 'i1' });
    expect(attributeMovement(investor, treasury)).toEqual({ userId: 'u1', investorId: 'i1' });
  });

  it('leaves attribution empty when no investor is involved', () => {
    const treasury = { address: WALLET, role: 'stablecoin_treasury' as const };
    expect(attributeMovement(treasury, treasury)).toEqual({ userId: null, investorId: null });
  });
});
