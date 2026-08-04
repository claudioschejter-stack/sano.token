import { expect } from 'chai';
import hre from 'hardhat';
import type { Contract, ContractFactory } from 'ethers';

type TestSigner = { address: string };

const hardhatEthers = (
  hre as unknown as {
    ethers: {
      getSigners: () => Promise<TestSigner[]>;
      getContractFactory: (name: string) => Promise<ContractFactory>;
      getContractAt: (name: string, address: string) => Promise<Contract>;
      getImpersonatedSigner: (address: string) => Promise<TestSigner>;
      provider: { send: (method: string, params: unknown[]) => Promise<unknown> };
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

  async function deployFixture() {
    const signers = await hardhatEthers.getSigners();
    const [deployer, operator, investor, outsider] = signers;

    // A minimal Safe stand-in: forwards module calls and holds the shares.
    const safeFactory = await hardhatEthers.getContractFactory('MockSafeModuleHost');
    const safe = await safeFactory.deploy();
    await safe.waitForDeployment();
    const safeAddress = await safe.getAddress();

    const tokenFactory = await hardhatEthers.getContractFactory('MockKycToken');
    const token = await tokenFactory.deploy();
    await token.waitForDeployment();

    const vaultFactory = await hardhatEthers.getContractFactory('MockShareToken');
    const vault = await vaultFactory.deploy(safeAddress, 1000n * ONE);
    await vault.waitForDeployment();

    const moduleFactory = await hardhatEthers.getContractFactory('SanovaDeliveryOperatorModule');
    const module = await moduleFactory.deploy(safeAddress);
    await module.waitForDeployment();

    return {
      deployer,
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
    const asOutsider = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.outsider.address)
    ) as Contract;

    await expect(asOutsider.setOperator(ctx.outsider.address, true)).to.be.revertedWithCustomError(
      ctx.module,
      'NotSafe'
    );
    await expect(
      asOutsider.setVaultAllowed(ctx.vaultAddress, ctx.tokenAddress, 0n)
    ).to.be.revertedWithCustomError(ctx.module, 'NotSafe');
  });

  it('delivers shares from the Safe to a whitelisted investor', async () => {
    const ctx = await wire();
    const asOperator = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.operator.address)
    ) as Contract;

    await asOperator.deliverShares(ctx.vaultAddress, ctx.investor.address, 10n * ONE);

    expect(await ctx.vault.balanceOf(ctx.investor.address)).to.equal(10n * ONE);
    expect(await ctx.vault.balanceOf(ctx.safeAddress)).to.equal(990n * ONE);
  });

  it('refuses to send to an investor the token has not whitelisted', async () => {
    const ctx = await wire();
    const asOperator = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.operator.address)
    ) as Contract;

    await expect(
      asOperator.deliverShares(ctx.vaultAddress, ctx.outsider.address, ONE)
    ).to.be.revertedWithCustomError(ctx.module, 'RecipientNotApproved');
  });

  it('refuses a vault that was never allowlisted', async () => {
    const ctx = await wire();
    const otherVaultFactory = await hardhatEthers.getContractFactory('MockShareToken');
    const otherVault = await otherVaultFactory.deploy(ctx.safeAddress, 100n * ONE);
    await otherVault.waitForDeployment();

    const asOperator = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.operator.address)
    ) as Contract;

    await expect(
      asOperator.deliverShares(await otherVault.getAddress(), ctx.investor.address, ONE)
    ).to.be.revertedWithCustomError(ctx.module, 'VaultNotAllowed');
  });

  it('refuses a wallet that is not an operator', async () => {
    const ctx = await wire();
    const asOutsider = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.outsider.address)
    ) as Contract;

    await expect(
      asOutsider.deliverShares(ctx.vaultAddress, ctx.investor.address, ONE)
    ).to.be.revertedWithCustomError(ctx.module, 'NotOperator');
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

    const asOperator = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.operator.address)
    ) as Contract;

    await expect(
      asOperator.deliverShares(ctx.vaultAddress, ctx.investor.address, 6n * ONE)
    ).to.be.revertedWithCustomError(ctx.module, 'AmountAboveCap');

    await asOperator.deliverShares(ctx.vaultAddress, ctx.investor.address, 5n * ONE);
    expect(await ctx.vault.balanceOf(ctx.investor.address)).to.equal(5n * ONE);
  });

  it('revoking the vault stops further delivery', async () => {
    const ctx = await wire();
    const asOperator = ctx.module.connect(
      await hardhatEthers.getImpersonatedSigner(ctx.operator.address)
    ) as Contract;

    await asOperator.deliverShares(ctx.vaultAddress, ctx.investor.address, ONE);

    await ctx.safe.callModule(
      ctx.moduleAddress,
      ctx.module.interface.encodeFunctionData('setVaultAllowed', [
        ctx.vaultAddress,
        '0x0000000000000000000000000000000000000000',
        0n
      ])
    );

    await expect(
      asOperator.deliverShares(ctx.vaultAddress, ctx.investor.address, ONE)
    ).to.be.revertedWithCustomError(ctx.module, 'VaultNotAllowed');
  });

  it('canDeliver mirrors what the module would actually accept', async () => {
    const ctx = await wire();
    expect(await ctx.module.canDeliver(ctx.vaultAddress, ctx.investor.address, ONE)).to.equal(true);
    expect(await ctx.module.canDeliver(ctx.vaultAddress, ctx.outsider.address, ONE)).to.equal(
      false
    );
    expect(await ctx.module.canDeliver(ctx.vaultAddress, ctx.investor.address, 0n)).to.equal(false);
  });
});
