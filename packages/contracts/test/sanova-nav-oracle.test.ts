import { expect } from 'chai';
import hre from 'hardhat';
import { id as ethersId } from 'ethers';
import type { Contract, ContractFactory, ContractTransactionResponse } from 'ethers';

type TestSigner = {
  address: string;
};

type SanovaAssetToken = Contract & {
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
};

type SanovaRwaVault = Contract & {
  deposit: (assets: bigint, receiver: string) => Promise<ContractTransactionResponse>;
};

type SanovaNavOracle = Contract & {
  price: () => Promise<bigint>;
  updateNav: (nav: bigint, auditHash: string) => Promise<ContractTransactionResponse>;
  navPerAssetMicroUsd: () => Promise<bigint>;
};

const hardhatEthers = (
  hre as unknown as {
    ethers: {
      getSigners: () => Promise<TestSigner[]>;
      getContractFactory: (name: string) => Promise<ContractFactory>;
    };
  }
).ethers;

describe('SanovaNavOracle', () => {
  it('prices vault shares using ERC-4626 convertToAssets and audited NAV', async () => {
    const [owner, updater] = await hardhatEthers.getSigners();
    const Token = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await Token.deploy('Añelo UV3 RWA', 'UV3RWA', owner.address)) as SanovaAssetToken;
    await token.setKyc(owner.address, true);

    const Vault = await hardhatEthers.getContractFactory('SanovaRwaVault');
    const vault = (await Vault.deploy(
      await token.getAddress(),
      'Añelo UV3 Vault',
      'vUV3RWA',
      owner.address
    )) as SanovaRwaVault;

    await token.setKyc(await vault.getAddress(), true);
    await vault.setExternalContractAllowed(owner.address, true);

    const mintAmount = 1_000n * 10n ** 18n;
    const mintTx = await (token as Contract & { mint: (to: string, amount: bigint) => Promise<ContractTransactionResponse> }).mint(
      owner.address,
      mintAmount
    );
    await mintTx.wait();
    await (token as Contract & { approve: (spender: string, amount: bigint) => Promise<ContractTransactionResponse> }).approve(
      await vault.getAddress(),
      mintAmount
    );
    await vault.deposit(mintAmount, owner.address);

    const navPerAssetMicroUsd = 20_000_000n; // $20 per token
    const Oracle = await hardhatEthers.getContractFactory('SanovaNavOracle');
    const oracle = (await Oracle.deploy(
      await vault.getAddress(),
      navPerAssetMicroUsd,
      updater.address,
      owner.address
    )) as SanovaNavOracle;

    const price = await oracle.price();
    // Morpho scale: microUsd * 1e18 => 20e6 * 1e18 = 20e24
    expect(price).to.equal(20_000_000n * 10n ** 18n);

    await (oracle.connect(updater) as SanovaNavOracle).updateNav(21_000_000n, ethersId('audit-q1-2026'));
    expect(await oracle.navPerAssetMicroUsd()).to.equal(21_000_000n);
    expect(await oracle.price()).to.equal(21_000_000n * 10n ** 18n);
  });
});
