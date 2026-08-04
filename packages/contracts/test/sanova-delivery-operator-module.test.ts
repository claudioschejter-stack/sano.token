import { expect } from 'chai';
import hre from 'hardhat';
import type { BaseContract, ContractFactory, ContractRunner, ContractTransactionResponse } from 'ethers';

type TestSigner = ContractRunner & { address: string };

type DeliveryModule = Omit<BaseContract, 'connect'> & {
  connect: (runner: ContractRunner) => DeliveryModule;
  deliverShares: (
    vault: string,
    investor: string,
    amount: bigint
  ) => Promise<ContractTransactionResponse>;
  setOperator: (operator: string, allowed: boolean) => Promise<ContractTransactionResponse>;
  setVaultAllowed: (
    vault: string,
    kycToken: string,
    maxPerTx: bigint
  ) => Promise<ContractTransactionResponse>;
  canDeliver: (vault: string, investor: string, amount: bigint) => Promise<boolean>;
};

type MockSafe = BaseContract & {
  callModule: (module: string, data: string) => Promise<ContractTransactionResponse>;
};

type MockKycToken = BaseContract & {
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
};

type MockShareToken = BaseContract & {
  balanceOf: (account: string) => Promise<bigint>;
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
 * The module is what keeps checkout automatic once the Safe needs two
 * signatures, so its guard rails are the security boundary: it must only ever
 * move allowlisted vaults, towards investors the token already whitelisted.
 */
describe('SanovaDeliveryOperatorModule', () => {
  const ONE = 10n ** 18n;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  async function expectRevert(promise: Promise<unknown>, customError: string) {
    try {
      await promise;
    } catch (error) {
      expect(String(error)).to.contain(customError);
      return;
    }
    throw new Error(`expected revert with ${customError}`);
  }

  async function deployFixture() {
    const [, operator, investor, outsider] = await hardhatEthers.getSigners();

    // A minimal Safe stand-in: forwards module calls and holds the shares.
    const safeFactory = await hardhatEthers.getContractFactory('MockSafeModuleHost');
    const safe = (await safeFactory.deploy()) as unknown as MockSafe;
    await safe.waitForDeployment();
    const safeAddress = await safe.getAddress();

    const tokenFactory = await hardhatEthers.getContractFactory('MockKycToken');
    const token = (await tokenFactory.deploy()) as unknown as MockKycToken;
    await token.waitForDeployment();

    const vaultFactory = await hardhatEthers.getContractFactory('MockShareToken');
    const vault = (await vaultFactory.deploy(safeAddress, 1000n * ONE)) as unknown as MockShareToken;
    await vault.waitForDeployment();

    const moduleFactory = await hardhatEthers.getContractFactory('SanovaDeliveryOperatorModule');
    const module = (await moduleFactory.deploy(safeAddress)) as unknown as DeliveryModule;
    await module.waitForDeployment();

    return {
      operator,
      investor,
      outsider,
      safe,
      safeAddress,
      token,
      vault,
      module,
      moduleAddress: await module.getAddress(),
      tokenAddress: await token.getAddress(),
      vaultAddress: await vault.getAddress()
    };
  }

  async function wire() {
    const ctx = await deployFixture();
    await ctx.safe.callModule(
      ctx.moduleAddress,
      ctx.module.interface.encodeFunctionData('setOperator', [ctx.operator.address, true])
    );
    await ctx.safe.callModule(
      ctx.moduleAddress,
      ctx.module.interface.encodeFunctionData('setVaultAllowed', [
        ctx.vaultAddress,
        ctx.tokenAddress,
        0n
      ])
    );
    await ctx.token.setKyc(ctx.investor.address, true);
    return ctx;
  }

  it('only the Safe can grant operator or allowlist a vault', async () => {
    const ctx = await deployFixture();
    const asOutsider = ctx.module.connect(ctx.outsider);

    await expectRevert(asOutsider.setOperator(ctx.outsider.address, true), 'NotSafe');
    await expectRevert(
      asOutsider.setVaultAllowed(ctx.vaultAddress, ctx.tokenAddress, 0n),
      'NotSafe'
    );
  });

  it('delivers shares from the Safe to a whitelisted investor', async () => {
    const ctx = await wire();

    await ctx.module.connect(ctx.operator).deliverShares(
      ctx.vaultAddress,
      ctx.investor.address,
      10n * ONE
    );

    expect(await ctx.vault.balanceOf(ctx.investor.address)).to.equal(10n * ONE);
    expect(await ctx.vault.balanceOf(ctx.safeAddress)).to.equal(990n * ONE);
  });

  it('refuses to send to an investor the token has not whitelisted', async () => {
    const ctx = await wire();

    await expectRevert(
      ctx.module.connect(ctx.operator).deliverShares(ctx.vaultAddress, ctx.outsider.address, ONE),
      'RecipientNotApproved'
    );
  });

  it('refuses a vault that was never allowlisted', async () => {
    const ctx = await wire();
    const otherVaultFactory = await hardhatEthers.getContractFactory('MockShareToken');
    const otherVault = (await otherVaultFactory.deploy(
      ctx.safeAddress,
      100n * ONE
    )) as unknown as MockShareToken;
    await otherVault.waitForDeployment();

    await expectRevert(
      ctx.module
        .connect(ctx.operator)
        .deliverShares(await otherVault.getAddress(), ctx.investor.address, ONE),
      'VaultNotAllowed'
    );
  });

  it('refuses a wallet that is not an operator', async () => {
    const ctx = await wire();

    await expectRevert(
      ctx.module.connect(ctx.outsider).deliverShares(ctx.vaultAddress, ctx.investor.address, ONE),
      'NotOperator'
    );
  });

  it('enforces the per-transaction cap when one is set', async () => {
    const ctx = await wire();
    await ctx.safe.callModule(
      ctx.moduleAddress,
      ctx.module.interface.encodeFunctionData('setVaultAllowed', [
        ctx.vaultAddress,
        ctx.tokenAddress,
        5n * ONE
      ])
    );

    await expectRevert(
      ctx.module
        .connect(ctx.operator)
        .deliverShares(ctx.vaultAddress, ctx.investor.address, 6n * ONE),
      'AmountAboveCap'
    );

    await ctx.module
      .connect(ctx.operator)
      .deliverShares(ctx.vaultAddress, ctx.investor.address, 5n * ONE);
    expect(await ctx.vault.balanceOf(ctx.investor.address)).to.equal(5n * ONE);
  });

  it('revoking the vault stops further delivery', async () => {
    const ctx = await wire();

    await ctx.module.connect(ctx.operator).deliverShares(ctx.vaultAddress, ctx.investor.address, ONE);

    await ctx.safe.callModule(
      ctx.moduleAddress,
      ctx.module.interface.encodeFunctionData('setVaultAllowed', [
        ctx.vaultAddress,
        ZERO_ADDRESS,
        0n
      ])
    );

    await expectRevert(
      ctx.module.connect(ctx.operator).deliverShares(ctx.vaultAddress, ctx.investor.address, ONE),
      'VaultNotAllowed'
    );
  });

  it('canDeliver mirrors what the module would actually accept', async () => {
    const ctx = await wire();
    expect(await ctx.module.canDeliver(ctx.vaultAddress, ctx.investor.address, ONE)).to.equal(true);
    expect(await ctx.module.canDeliver(ctx.vaultAddress, ctx.outsider.address, ONE)).to.equal(false);
    expect(await ctx.module.canDeliver(ctx.vaultAddress, ctx.investor.address, 0n)).to.equal(false);
  });
});
