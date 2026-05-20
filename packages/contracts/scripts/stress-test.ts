import hre from 'hardhat';
import { parseUnits } from 'ethers';
import type { ContractFactory, ContractTransactionResponse } from 'ethers';

type StressSigner = {
  address: string;
};

type HardhatEthers = {
  getSigners: () => Promise<StressSigner[]>;
  getContractFactory: (name: string) => Promise<ContractFactory>;
  getContractAt: (name: string, address: string) => Promise<SanovaAssetToken>;
};

type SanovaAssetToken = {
  setKyc: (account: string, approved: boolean) => Promise<ContractTransactionResponse>;
  mint: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  transfer: (to: string, amount: bigint) => Promise<ContractTransactionResponse>;
  getAddress: () => Promise<string>;
  waitForDeployment: () => Promise<SanovaAssetToken>;
  connect: (signer: StressSigner) => SanovaAssetToken;
};

const hardhatEthers = (hre as unknown as { ethers: HardhatEthers }).ethers;

const INVESTOR_COUNT = 10;
const TRANSFER_COUNT = 50;
const TOKEN_DECIMALS = 18;
const TOTAL_SUPPLY_UNITS = 100_000;
const HOLDING_WEIGHTS = [20, 15, 12, 10, 9, 8, 7, 6, 5, 8];

function tokenAmount(units: number) {
  return parseUnits(units.toString(), TOKEN_DECIMALS);
}

async function waitForTx(label: string, txPromise: Promise<ContractTransactionResponse>) {
  const tx = await txPromise;
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} failed. tx=${tx.hash}`);
  }

  return receipt;
}

async function resolveAssetToken(ownerAddress: string): Promise<SanovaAssetToken> {
  const configuredAddress = process.env.SANOVA_ASSET_TOKEN_ADDRESS ?? process.env.ERC3643_TOKEN_ADDRESS;

  if (configuredAddress) {
    console.log(`[stress] Using existing SanovaAssetToken at ${configuredAddress}`);
    return hardhatEthers.getContractAt('SanovaAssetToken', configuredAddress) as Promise<SanovaAssetToken>;
  }

  const factory = await hardhatEthers.getContractFactory('SanovaAssetToken');
  const contract = (await factory.deploy('Sanova Tolhuin RWA', 'TOLHUIN', ownerAddress)) as unknown as SanovaAssetToken;
  await contract.waitForDeployment();

  console.log(`[stress] Deployed SanovaAssetToken at ${await contract.getAddress()}`);
  return contract;
}

async function main() {
  const signers = await hardhatEthers.getSigners();

  if (signers.length < INVESTOR_COUNT + 1) {
    throw new Error(`Hardhat node must expose at least ${INVESTOR_COUNT + 1} funded accounts.`);
  }

  const [owner, ...investors] = signers.slice(0, INVESTOR_COUNT + 1);
  const investorWallets = investors.slice(0, INVESTOR_COUNT);
  const assetToken = await resolveAssetToken(owner.address);
  const assetAddress = await assetToken.getAddress();

  console.log(`[stress] Owner=${owner.address}`);
  console.log(`[stress] Asset=Tolhuin token=${assetAddress}`);
  console.log(`[stress] Investors=${investorWallets.map((wallet) => wallet.address).join(', ')}`);

  console.log('[stress] Applying KYC whitelist...');
  for (const investor of investorWallets) {
    await waitForTx(`setKyc(${investor.address})`, assetToken.connect(owner).setKyc(investor.address, true));
  }

  console.log('[stress] Minting weighted Tolhuin holdings...');
  for (let index = 0; index < investorWallets.length; index += 1) {
    const investor = investorWallets[index];
    const weight = HOLDING_WEIGHTS[index];
    const amount = tokenAmount((TOTAL_SUPPLY_UNITS * weight) / 100);

    await waitForTx(`mint(${investor.address})`, assetToken.connect(owner).mint(investor.address, amount));
    console.log(`[stress] Minted ${weight}% to ${investor.address}`);
  }

  console.log(`[stress] Executing ${TRANSFER_COUNT} consecutive transfers...`);
  for (let index = 0; index < TRANSFER_COUNT; index += 1) {
    const sender = investorWallets[index % INVESTOR_COUNT];
    const receiver = investorWallets[(index + 1) % INVESTOR_COUNT];
    const amount = tokenAmount(1 + (index % 5));

    await waitForTx(
      `transfer(${index + 1}/${TRANSFER_COUNT})`,
      assetToken.connect(sender).transfer(receiver.address, amount)
    );

    if ((index + 1) % 10 === 0) {
      console.log(`[stress] Confirmed ${index + 1}/${TRANSFER_COUNT} transfers`);
    }
  }

  console.log('[stress] Completed successfully.');
  console.log(`[stress] Configure backend ERC3643_TOKEN_ADDRESSES=${assetAddress}`);
}

main().catch((error: unknown) => {
  console.error('[stress] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
