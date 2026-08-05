import { expect } from 'chai';
import hre from 'hardhat';
import { AbiCoder, keccak256 } from 'ethers';
import type { BaseContract, ContractFactory, ContractRunner, ContractTransactionResponse } from 'ethers';

type TestSigner = ContractRunner & { address: string };

type AssetToken = Omit<BaseContract, 'connect'> & {
  connect: (runner: ContractRunner) => AssetToken;
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
  scheduleAdminAction: (actionId: string) => Promise<ContractTransactionResponse>;
  adminActionReadyAt: (actionId: string) => Promise<bigint>;
  adminActionDelay: () => Promise<bigint>;
  kycApproved: (account: string) => Promise<boolean>;
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
 * The app computes this action id off-chain to schedule an approval. If it does
 * not match what the token computes, the schedule lands on an id nobody will
 * ever execute and `setKyc` keeps reverting with no clue why — which is exactly
 * what happened in production.
 */
function kycActionId(investor: string, approved: boolean): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(['string', 'address', 'bool'], ['SET_KYC', investor, approved])
  );
}

describe('SanovaAssetToken KYC timelock', () => {
  const ONE_HOUR = 3600;

  async function deployed() {
    const [owner, investor] = await hardhatEthers.getSigners();
    const factory = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await factory.deploy('Sanova Test', 'SNVT', owner.address)) as unknown as AssetToken;
    await token.waitForDeployment();
    return { token, owner, investor };
  }

  async function advance(seconds: number) {
    await hardhatEthers.provider.send('evm_increaseTime', [seconds]);
    await hardhatEthers.provider.send('evm_mine', []);
  }

  it('approves without waiting inside the deployment setup window', async () => {
    const { token, investor } = await deployed();
    await token.setKyc(investor.address, true);
    expect(await token.kycApproved(investor.address)).to.equal(true);
  });

  it('refuses an unscheduled approval once the window closes', async () => {
    const { token, investor } = await deployed();
    await advance(ONE_HOUR + 60);

    try {
      await token.setKyc(investor.address, true);
      throw new Error('expected the timelock to reject this');
    } catch (error) {
      expect(String(error)).to.contain('KYC timelock pending');
    }
  });

  it('accepts the approval once scheduled and the delay has passed', async () => {
    const { token, investor } = await deployed();
    await advance(ONE_HOUR + 60);

    await token.scheduleAdminAction(kycActionId(investor.address, true));
    const delay = Number(await token.adminActionDelay());
    await advance(delay + 60);

    await token.setKyc(investor.address, true);
    expect(await token.kycApproved(investor.address)).to.equal(true);
  });

  it('still refuses while the scheduled delay is running', async () => {
    const { token, investor } = await deployed();
    await advance(ONE_HOUR + 60);
    await token.scheduleAdminAction(kycActionId(investor.address, true));

    try {
      await token.setKyc(investor.address, true);
      throw new Error('expected the timelock to reject this');
    } catch (error) {
      expect(String(error)).to.contain('KYC timelock pending');
    }
  });

  it('computes the same action id the app does', async () => {
    const { token, investor } = await deployed();
    await advance(ONE_HOUR + 60);

    const actionId = kycActionId(investor.address, true);
    await token.scheduleAdminAction(actionId);

    // Non-zero only if the token recognises this exact id.
    expect(await token.adminActionReadyAt(actionId)).to.not.equal(0n);
  });

  it('binds the schedule to the exact approval value', async () => {
    const { token, investor } = await deployed();
    await advance(ONE_HOUR + 60);

    // Scheduling an approval does not authorise a revocation.
    await token.scheduleAdminAction(kycActionId(investor.address, true));
    expect(await token.adminActionReadyAt(kycActionId(investor.address, false))).to.equal(0n);
  });

  it('consumes the schedule, so a second approval needs a new one', async () => {
    const { token, investor } = await deployed();
    await advance(ONE_HOUR + 60);

    await token.scheduleAdminAction(kycActionId(investor.address, true));
    await advance(Number(await token.adminActionDelay()) + 60);
    await token.setKyc(investor.address, true);

    expect(await token.adminActionReadyAt(kycActionId(investor.address, true))).to.equal(0n);
  });
});
