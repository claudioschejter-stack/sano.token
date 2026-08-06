import { expect } from 'chai';
import hre from 'hardhat';
import type { BaseContract, ContractFactory, ContractTransactionResponse } from 'ethers';

type TestSigner = { address: string };

type AssetToken = BaseContract & {
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
  setExternalContractAllowed: (
    account: string,
    allowed: boolean
  ) => Promise<ContractTransactionResponse>;
  mint: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  approve: (spender: string, amount: bigint) => Promise<ContractTransactionResponse>;
  balanceOf: (account: string) => Promise<bigint>;
  decimals: () => Promise<bigint>;
};

type AnyVault = BaseContract & {
  deposit: (assets: bigint, receiver: string) => Promise<ContractTransactionResponse>;
  redeem: (
    shares: bigint,
    receiver: string,
    owner: string
  ) => Promise<ContractTransactionResponse>;
  transfer: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  balanceOf: (account: string) => Promise<bigint>;
  totalSupply: () => Promise<bigint>;
  previewRedeem: (shares: bigint) => Promise<bigint>;
  decimals: () => Promise<bigint>;
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
 * The migration, end to end, against the real contracts.
 *
 * A project has to move off the vault it was deployed on, because that vault
 * rejects any holder carrying code and a deployed contract cannot be changed.
 * The sequence redeems the treasury's shares out of the old vault and deposits
 * them into a new one, and the two vaults do not even share a share unit — the
 * old one has 18 decimals, the new one 21.
 *
 * So the things worth proving are that the token count survives the move, and
 * that the investor the old vault refused is accepted by the new one.
 *
 * The treasury here is an ordinary account rather than a Safe. Production's Safe
 * is already allowlisted as a holder on both the token and the old vault, which
 * was checked on-chain; the address that matters for the bug is the investor's.
 */
describe('Vault migration', () => {
  const TOTAL_TOKENS = 5000n;

  async function expectRevert(promise: Promise<unknown>, reason: string) {
    try {
      await promise;
    } catch (error) {
      expect(String(error)).to.contain(reason);
      return;
    }
    throw new Error(`expected revert with ${reason}`);
  }

  it('preserves the token count and unblocks the investor the old vault refused', async () => {
    const [treasury] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await Token.deploy('Añelo RWA', 'ANELO', treasury.address)) as AssetToken;
    const tokenAddress = await token.getAddress();
    const assetUnit = 10n ** (await token.decimals());

    // Stands in for the investor's wallet: a contract, which is what an EIP-7702
    // delegated Privy wallet looks like to these checks.
    const Wallet = await hardhatEthers.getContractFactory('MockSafeModuleHost');
    const investorWallet = await Wallet.deploy();
    const investor = await investorWallet.getAddress();
    await token.setKyc(investor, true);

    // ── The project as it exists today ─────────────────────────────────────
    const Legacy = await hardhatEthers.getContractFactory('LegacyRwaVault');
    const oldVault = (await Legacy.deploy(
      tokenAddress,
      'Añelo Vault',
      'vANELO',
      treasury.address
    )) as AnyVault;
    const oldVaultAddress = await oldVault.getAddress();

    await token.setKyc(oldVaultAddress, true);
    await token.setExternalContractAllowed(oldVaultAddress, true);
    await token.mint(treasury.address, TOTAL_TOKENS * assetUnit);
    await token.approve(oldVaultAddress, TOTAL_TOKENS * assetUnit);
    await oldVault.deposit(TOTAL_TOKENS * assetUnit, treasury.address);

    const oldShareUnit = 10n ** (await oldVault.decimals());
    expect(await oldVault.decimals()).to.equal(18n);
    expect(await oldVault.balanceOf(treasury.address)).to.equal(TOTAL_TOKENS * oldShareUnit);

    // The failure that started all of this: the investor is KYC-approved and the
    // vault still refuses them, for having code.
    await expectRevert(
      oldVault.transfer(investor, oldShareUnit),
      'contract receiver not allowed'
    );

    // ── The migration ──────────────────────────────────────────────────────
    const Vault = await hardhatEthers.getContractFactory('SanovaRwaVault');
    const newVault = (await Vault.deploy(
      tokenAddress,
      'Añelo Vault',
      'vANELO',
      treasury.address
    )) as AnyVault;
    const newVaultAddress = await newVault.getAddress();

    // What the timelock gates in production: letting the new vault hold the token.
    await token.setKyc(newVaultAddress, true);
    await token.setExternalContractAllowed(newVaultAddress, true);

    const shares = await oldVault.balanceOf(treasury.address);
    const assets = await oldVault.previewRedeem(shares);
    await oldVault.redeem(shares, treasury.address, treasury.address);

    expect(await oldVault.totalSupply()).to.equal(0n);
    expect(await token.balanceOf(treasury.address)).to.equal(assets);

    await token.approve(newVaultAddress, assets);
    await newVault.deposit(assets, treasury.address);

    // ── What has to be true afterwards ─────────────────────────────────────
    const newShareUnit = 10n ** (await newVault.decimals());
    expect(await newVault.decimals()).to.equal(21n);

    /**
     * The raw numbers differ by a thousand between the two vaults, and the token
     * count is identical. Reading the new balance with the old unit is the bug
     * this whole migration would otherwise introduce.
     */
    expect(await newVault.balanceOf(treasury.address)).to.equal(TOTAL_TOKENS * newShareUnit);
    expect(await newVault.balanceOf(treasury.address)).to.not.equal(TOTAL_TOKENS * oldShareUnit);

    // And the payoff: no allowlist entry, and the investor gets their token.
    await newVault.transfer(investor, newShareUnit);
    expect(await newVault.balanceOf(investor)).to.equal(newShareUnit);
    expect(await newVault.balanceOf(treasury.address)).to.equal(
      (TOTAL_TOKENS - 1n) * newShareUnit
    );
  });

  it('still refuses a holder KYC never cleared, after the migration', async () => {
    const [treasury] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory('SanovaAssetToken');
    const token = (await Token.deploy('Añelo RWA', 'ANELO', treasury.address)) as AssetToken;
    const tokenAddress = await token.getAddress();
    const assetUnit = 10n ** (await token.decimals());

    const Vault = await hardhatEthers.getContractFactory('SanovaRwaVault');
    const vault = (await Vault.deploy(
      tokenAddress,
      'Añelo Vault',
      'vANELO',
      treasury.address
    )) as AnyVault;
    const vaultAddress = await vault.getAddress();

    await token.setKyc(vaultAddress, true);
    await token.setExternalContractAllowed(vaultAddress, true);
    await token.mint(treasury.address, TOTAL_TOKENS * assetUnit);
    await token.approve(vaultAddress, TOTAL_TOKENS * assetUnit);
    await vault.deposit(TOTAL_TOKENS * assetUnit, treasury.address);

    // A public liquidity pool would look exactly like this: code, and no KYC.
    const Pool = await hardhatEthers.getContractFactory('MockSafeModuleHost');
    const pool = await (await Pool.deploy()).getAddress();

    await expectRevert(
      vault.transfer(pool, 10n ** (await vault.decimals())),
      'share transfer requires KYC'
    );
  });
});
