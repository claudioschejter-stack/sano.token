import type { Contract } from 'ethers';
import { waitForAutomationTx } from './automationTx';

export type OwnershipTransferResult = {
  contractName: string;
  contractAddress: string;
  status: 'TRANSFERRED' | 'ALREADY_TREASURY' | 'SKIPPED' | 'FAILED';
  owner: string | null;
  treasuryAddress: string;
  txHash?: string | null;
  message?: string;
};

export async function transferOwnershipToTreasury(input: {
  contractName: string;
  contract: Contract;
  contractAddress: string;
  deployerAddress: string;
  treasuryAddress: string;
}): Promise<OwnershipTransferResult> {
  const treasuryAddress = input.treasuryAddress;
  if (treasuryAddress.toLowerCase() === input.deployerAddress.toLowerCase()) {
    return {
      contractName: input.contractName,
      contractAddress: input.contractAddress,
      status: 'SKIPPED',
      owner: input.deployerAddress,
      treasuryAddress,
      message: 'Treasury igual a deployer; transferencia omitida.'
    };
  }

  try {
    const owner = String(await input.contract.owner());
    if (owner.toLowerCase() === treasuryAddress.toLowerCase()) {
      return {
        contractName: input.contractName,
        contractAddress: input.contractAddress,
        status: 'ALREADY_TREASURY',
        owner,
        treasuryAddress
      };
    }

    if (owner.toLowerCase() !== input.deployerAddress.toLowerCase()) {
      return {
        contractName: input.contractName,
        contractAddress: input.contractAddress,
        status: 'SKIPPED',
        owner,
        treasuryAddress,
        message: 'La deployer no es owner actual.'
      };
    }

    const tx = await input.contract.transferOwnership(treasuryAddress);
    const receipt = await waitForAutomationTx(tx);
    const nextOwner = String(await input.contract.owner());
    if (nextOwner.toLowerCase() !== treasuryAddress.toLowerCase()) {
      return {
        contractName: input.contractName,
        contractAddress: input.contractAddress,
        status: 'FAILED',
        owner: nextOwner,
        treasuryAddress,
        txHash: receipt?.hash ?? tx.hash,
        message: 'owner() no coincide con treasury después de transferOwnership.'
      };
    }

    return {
      contractName: input.contractName,
      contractAddress: input.contractAddress,
      status: 'TRANSFERRED',
      owner: nextOwner,
      treasuryAddress,
      txHash: receipt?.hash ?? tx.hash
    };
  } catch (error) {
    return {
      contractName: input.contractName,
      contractAddress: input.contractAddress,
      status: 'FAILED',
      owner: null,
      treasuryAddress,
      message: error instanceof Error ? error.message : 'Ownership transfer failed'
    };
  }
}
