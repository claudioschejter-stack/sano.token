import { expect } from 'chai';
import hre from 'hardhat';
import type { Contract, ContractFactory, ContractTransactionResponse } from 'ethers';

type TestSigner = { address: string };

type AssetToken = Contract & {
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
  setExternalContractAllowed: (
    account: string,
    allowed: boolean
  ) => Promise<ContractTransactionResponse>;
  mint: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  approve: (spender: string, amount: bigint) => Promise<ContractTransactionResponse>;
  decimals: () => Promise<bigint>;
};

type Vault = Contract & {
  deposit: (assets: bigint, receiver: string) => Promise<ContractTransactionResponse>;
  balanceOf: (account: string) => Promise<bigint>;
  decimals: () => Promise<bigint>;
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
 * The platform's central invariant: one RWA token is one vault share.
 *
 * It survives the inflation-attack offset, but only in the vault's own units —
 * a share is `10 ** vault.decimals()`, not `1e18`. Every place that assumed 1e18
 * would have delivered a thousandth of a purchase, or reported a holding a
 * thousand times too large, the moment an asset was deployed with the offset in
 * place. This pins the invariant so the next offset change fails here instead of
 * in production.
 */
describe('Vault share units', () => {
  it('mints exactly one whole share per asset token, in the vault own units', async () => {
    const [owner] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await Token.deploy('Sanova Asset', 'SNVA', owner.address)) as AssetToken;

    const Vault = await hardhatEthers.getContractFactory('SanovaRwaVault');
    const vault = (await Vault.deploy(
      await token.getAddress(),
      'Sanova Vault',
      'vSNVA',
      owner.address
    )) as Vault;

    const vaultAddress = await vault.getAddress();
    await token.setKyc(vaultAddress, true);
    await token.setKyc(owner.address, true);
    await token.setExternalContractAllowed(vaultAddress, true);

    const tokens = 5000n;
    const assetUnit = 10n ** (await token.decimals());
    await token.mint(owner.address, tokens * assetUnit);
    await token.approve(vaultAddress, tokens * assetUnit);
    await vault.deposit(tokens * assetUnit, owner.address);

    const shareUnit = 10n ** (await vault.decimals());
    expect(await vault.balanceOf(owner.address)).to.equal(tokens * shareUnit);
  });

  it('reports share decimals as the asset decimals plus the offset', async () => {
    const [owner] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await Token.deploy('Sanova Asset', 'SNVA', owner.address)) as AssetToken;

    const Vault = await hardhatEthers.getContractFactory('SanovaRwaVault');
    const vault = (await Vault.deploy(
      await token.getAddress(),
      'Sanova Vault',
      'vSNVA',
      owner.address
    )) as Vault;

    // Reading it is the point: nothing downstream may hardcode this number.
    expect(await vault.decimals()).to.equal((await token.decimals()) + 3n);
  });
});
