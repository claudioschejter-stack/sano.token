import { expect } from 'chai';
import hre from 'hardhat';
import type { BaseContract, ContractFactory, ContractRunner, ContractTransactionResponse } from 'ethers';

type TestSigner = ContractRunner & { address: string };

type AssetToken = Omit<BaseContract, 'connect'> & {
  connect: (runner: ContractRunner) => AssetToken;
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
  mint: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  transfer: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  approve: (spender: string, amount: bigint) => Promise<ContractTransactionResponse>;
  balanceOf: (account: string) => Promise<bigint>;
  setExternalContractAllowed: (
    account: string,
    allowed: boolean
  ) => Promise<ContractTransactionResponse>;
};

type Vault = Omit<BaseContract, 'connect'> & {
  connect: (runner: ContractRunner) => Vault;
  deposit: (assets: bigint, receiver: string) => Promise<ContractTransactionResponse>;
  transfer: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  balanceOf: (account: string) => Promise<bigint>;
  setExternalContractAllowed: (
    account: string,
    allowed: boolean
  ) => Promise<ContractTransactionResponse>;
};

const hardhatEthers = (
  hre as unknown as {
    ethers: {
      getSigners: () => Promise<TestSigner[]>;
      getContractFactory: (name: string) => Promise<ContractFactory>;
    };
  }
).ethers;

/**
 * Investors hold shares through smart wallets, and a smart wallet has code.
 *
 * The code checks in `_update` are there to keep shares out of public liquidity
 * pools. Applied to every address with code they also rejected the investors
 * themselves — Privy delegates embedded wallets through EIP-7702 — which took
 * the payment and reverted the delivery with "contract receiver not allowed".
 * These tests fix both halves: a verified holder gets in, an unverified contract
 * stays out.
 */
describe('Smart-wallet holders', () => {
  const ONE = 10n ** 18n;

  async function expectRevert(promise: Promise<unknown>, reason: string) {
    try {
      await promise;
    } catch (error) {
      expect(String(error)).to.contain(reason);
      return;
    }
    throw new Error(`expected revert with ${reason}`);
  }

  async function deployFixture() {
    const [owner, holder] = await hardhatEthers.getSigners();

    const tokenFactory = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await tokenFactory.deploy(
      'Sanova Asset',
      'SNVA',
      owner.address
    )) as unknown as AssetToken;
    await token.waitForDeployment();

    const vaultFactory = await hardhatEthers.getContractFactory('SanovaRwaVault');
    const vault = (await vaultFactory.deploy(
      await token.getAddress(),
      'Sanova Vault',
      'vSNVA',
      owner.address
    )) as unknown as Vault;
    await vault.waitForDeployment();

    /**
     * Stands in for a smart wallet: any contract with code and no allowance is
     * indistinguishable from an EIP-7702 delegated wallet to these checks.
     */
    const walletFactory = await hardhatEthers.getContractFactory('MockSafeModuleHost');
    const smartWallet = await walletFactory.deploy();
    await smartWallet.waitForDeployment();

    return {
      owner,
      holder,
      token,
      vault,
      smartWallet: await smartWallet.getAddress(),
      vaultAddress: await vault.getAddress()
    };
  }

  it('lets a KYC-approved smart wallet receive asset tokens', async () => {
    const ctx = await deployFixture();
    await ctx.token.setKyc(ctx.smartWallet, true);
    await ctx.token.mint(ctx.owner.address, 10n * ONE);

    // No `externalContractAllowed` entry: KYC alone must be enough.
    await ctx.token.transfer(ctx.smartWallet, ONE);
    expect(await ctx.token.balanceOf(ctx.smartWallet)).to.equal(ONE);
  });

  it('still refuses a contract that KYC never cleared', async () => {
    const ctx = await deployFixture();
    await ctx.token.mint(ctx.owner.address, 10n * ONE);

    await expectRevert(ctx.token.transfer(ctx.smartWallet, ONE), 'transfer requires KYC');
  });

  it('lets a KYC-approved smart wallet receive vault shares', async () => {
    const ctx = await deployFixture();
    await ctx.token.setKyc(ctx.smartWallet, true);
    await ctx.token.setKyc(ctx.vaultAddress, true);
    await ctx.token.setExternalContractAllowed(ctx.vaultAddress, true);
    await ctx.token.mint(ctx.owner.address, 10n * ONE);

    await ctx.token.approve(ctx.vaultAddress, 10n * ONE);
    await ctx.vault.deposit(10n * ONE, ctx.owner.address);

    await ctx.vault.transfer(ctx.smartWallet, ONE);
    expect(await ctx.vault.balanceOf(ctx.smartWallet)).to.equal(ONE);
  });
});
