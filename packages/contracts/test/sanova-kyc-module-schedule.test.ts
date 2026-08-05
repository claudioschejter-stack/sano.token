import { expect } from 'chai';
import hre from 'hardhat';
import { AbiCoder, keccak256 } from 'ethers';
import type { BaseContract, ContractFactory, ContractRunner, ContractTransactionResponse } from 'ethers';

type TestSigner = ContractRunner & { address: string };

type KycModule = Omit<BaseContract, 'connect'> & {
  connect: (runner: ContractRunner) => KycModule;
  scheduleKyc: (token: string, investor: string, approved: boolean) => Promise<ContractTransactionResponse>;
  setKyc: (token: string, investor: string, approved: boolean) => Promise<ContractTransactionResponse>;
  kycActionId: (investor: string, approved: boolean) => Promise<string>;
};

type AssetToken = BaseContract & {
  transferOwnership: (owner: string) => Promise<ContractTransactionResponse>;
  adminActionReadyAt: (actionId: string) => Promise<bigint>;
  adminActionDelay: () => Promise<bigint>;
  kycApproved: (account: string) => Promise<boolean>;
};

type MockSafe = BaseContract & {
  callModule: (module: string, data: string) => Promise<ContractTransactionResponse>;
};

const hardhatEthers = (
  hre as unknown as {
    ethers: {
      getSigners: () => Promise<TestSigner[]>;
      getContractFactory: (name: string) => Promise<ContractFactory>;
      provider: { send: (method: string, params: unknown[]) => Promise<unknown> };
    };
  }
).ethers;

/**
 * Scheduling has to be delegable, because a Safe at threshold 2 cannot schedule
 * on demand without a human. What it must not become is a way for the operator
 * to schedule anything else.
 */
describe('SanovaKycOperatorModule scheduling', () => {
  const ONE_HOUR = 3600;

  async function advance(seconds: number) {
    await hardhatEthers.provider.send('evm_increaseTime', [seconds]);
    await hardhatEthers.provider.send('evm_mine', []);
  }

  async function wired() {
    const [deployer, operator, investor, outsider] = await hardhatEthers.getSigners();

    const safeFactory = await hardhatEthers.getContractFactory('MockSafeModuleHost');
    const safe = (await safeFactory.deploy()) as unknown as MockSafe;
    await safe.waitForDeployment();
    const safeAddress = await safe.getAddress();

    const tokenFactory = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await tokenFactory.deploy('Sanova', 'SNV', deployer.address)) as unknown as AssetToken;
    await token.waitForDeployment();
    await token.transferOwnership(safeAddress);
    const tokenAddress = await token.getAddress();

    const moduleFactory = await hardhatEthers.getContractFactory('SanovaKycOperatorModule');
    const module = (await moduleFactory.deploy(safeAddress)) as unknown as KycModule;
    await module.waitForDeployment();
    const moduleAddress = await module.getAddress();

    await safe.callModule(
      moduleAddress,
      module.interface.encodeFunctionData('setOperator', [operator.address, true])
    );
    await safe.callModule(
      moduleAddress,
      module.interface.encodeFunctionData('setTokenAllowed', [tokenAddress, true])
    );

    return { safe, token, tokenAddress, module, moduleAddress, operator, investor, outsider };
  }

  it('computes the same action id the token does', async () => {
    const ctx = await wired();
    const expected = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['string', 'address', 'bool'],
        ['SET_KYC', ctx.investor.address, true]
      )
    );
    expect(await ctx.module.kycActionId(ctx.investor.address, true)).to.equal(expected);
  });

  it('lets the operator schedule, which the token then recognises', async () => {
    const ctx = await wired();
    await advance(ONE_HOUR + 60);

    await ctx.module.connect(ctx.operator).scheduleKyc(ctx.tokenAddress, ctx.investor.address, true);

    const actionId = await ctx.module.kycActionId(ctx.investor.address, true);
    expect(await ctx.token.adminActionReadyAt(actionId)).to.not.equal(0n);
  });

  it('completes the whole approval with the operator alone, no Safe signature', async () => {
    const ctx = await wired();
    await advance(ONE_HOUR + 60);

    await ctx.module.connect(ctx.operator).scheduleKyc(ctx.tokenAddress, ctx.investor.address, true);
    await advance(Number(await ctx.token.adminActionDelay()) + 60);
    await ctx.module.connect(ctx.operator).setKyc(ctx.tokenAddress, ctx.investor.address, true);

    expect(await ctx.token.kycApproved(ctx.investor.address)).to.equal(true);
  });

  it('refuses to schedule for a wallet that is not an operator', async () => {
    const ctx = await wired();
    try {
      await ctx.module.connect(ctx.outsider).scheduleKyc(ctx.tokenAddress, ctx.investor.address, true);
      throw new Error('expected a revert');
    } catch (error) {
      expect(String(error)).to.contain('NotOperator');
    }
  });

  it('refuses to schedule on a token the Safe did not allowlist', async () => {
    const ctx = await wired();
    const otherFactory = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const other = await otherFactory.deploy('Otro', 'OTR', ctx.operator.address);
    await other.waitForDeployment();

    try {
      await ctx.module
        .connect(ctx.operator)
        .scheduleKyc(await other.getAddress(), ctx.investor.address, true);
      throw new Error('expected a revert');
    } catch (error) {
      expect(String(error)).to.contain('TokenNotAllowed');
    }
  });

  it('does not expose a way to schedule anything other than a whitelisting', async () => {
    const ctx = await wired();
    const fragments = ctx.module.interface.fragments
      .filter((row) => row.type === 'function')
      .map((row) => (row as unknown as { name: string }).name);

    // The action id is derived inside the module, so no caller can supply one.
    expect(fragments).to.not.include('scheduleAdminAction');
    for (const name of fragments) {
      const fragment = ctx.module.interface.getFunction(name);
      if (name === 'scheduleKyc') {
        expect(fragment?.inputs.map((row) => row.type)).to.deep.equal(['address', 'address', 'bool']);
      }
    }
  });

  it('binds the schedule to the exact approval value', async () => {
    const ctx = await wired();
    await advance(ONE_HOUR + 60);

    await ctx.module.connect(ctx.operator).scheduleKyc(ctx.tokenAddress, ctx.investor.address, true);
    const revokeId = await ctx.module.kycActionId(ctx.investor.address, false);
    expect(await ctx.token.adminActionReadyAt(revokeId)).to.equal(0n);
  });
});
