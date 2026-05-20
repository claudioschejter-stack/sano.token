import { expect } from 'chai';
import hre from 'hardhat';
import type { Contract, ContractFactory, ContractTransactionResponse } from 'ethers';

type TestSigner = {
  address: string;
};

type SanovaAssetToken = Contract & {
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
  kycApproved: (account: string) => Promise<boolean>;
};

const hardhatEthers = (
  hre as unknown as {
    ethers: {
      getSigners: () => Promise<TestSigner[]>;
      getContractFactory: (name: string) => Promise<ContractFactory>;
    };
  }
).ethers;

describe('Sanova contracts package', () => {
  it('deploys the regulated asset token', async () => {
    const [owner] = await hardhatEthers.getSigners();
    const Token = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await Token.deploy('Sanova Asset Token', 'sRWA', owner.address)) as SanovaAssetToken;
    const tx = await token.setKyc(owner.address, true);
    const receipt = await tx.wait(1);

    expect(receipt?.status).to.equal(1);
    expect(await token.kycApproved(owner.address)).to.equal(true);
  });
});
