'use client';

import { useCallback, useState } from 'react';
import {
  readContract,
  waitForTransactionReceipt,
  writeContract
} from '@wagmi/core';
import { erc20Abi, maxUint256, parseUnits } from 'viem';
import { useAccount, useConfig } from 'wagmi';
import { BASE_CHAIN_ID } from '../lib/web3/config';

const ERC4626_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  }
] as const;

export type BuyTokenStatus =
  | 'idle'
  | 'checking'
  | 'approving'
  | 'depositing'
  | 'success'
  | 'error';

export type BuyTokenInput = {
  vaultAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  amountUsd: string;
  usdcDecimals?: number;
  chainId?: number;
  /** Receiver of vault shares; defaults to connected wallet. */
  receiver?: `0x${string}`;
};

export type BuyTokenResult = {
  depositTxHash: `0x${string}`;
  approveTxHash?: `0x${string}`;
  shares?: bigint;
};

function parseUsdToBaseUnits(amountUsd: string, decimals: number): bigint {
  const normalized = amountUsd.includes('.') ? amountUsd : `${amountUsd}.0`;
  return parseUnits(normalized, decimals);
}

export function useBuyToken() {
  const config = useConfig();
  const { address, chainId, isConnected } = useAccount();
  const [status, setStatus] = useState<BuyTokenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>();
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setDepositTxHash(undefined);
    setApproveTxHash(undefined);
  }, []);

  const buy = useCallback(
    async (input: BuyTokenInput): Promise<BuyTokenResult> => {
      if (!isConnected || !address) {
        const message = 'WALLET_NOT_CONNECTED';
        setStatus('error');
        setError(message);
        throw new Error(message);
      }

      const targetChainId = input.chainId ?? BASE_CHAIN_ID;
      if (chainId !== targetChainId) {
        const { switchChain } = await import('@wagmi/core');
        await switchChain(config, { chainId: targetChainId });
      }

      const decimals = input.usdcDecimals ?? 6;
      const amount = parseUsdToBaseUnits(input.amountUsd, decimals);
      const receiver = input.receiver ?? address;

      setStatus('checking');
      setError(null);
      setDepositTxHash(undefined);
      setApproveTxHash(undefined);

      try {
        const allowance = await readContract(config, {
          address: input.usdcAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, input.vaultAddress],
          chainId: targetChainId
        });

        let approvalHash: `0x${string}` | undefined;

        if (allowance < amount) {
          setStatus('approving');
          approvalHash = await writeContract(config, {
            address: input.usdcAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [input.vaultAddress, maxUint256],
            chainId: targetChainId
          });

          setApproveTxHash(approvalHash);
          await waitForTransactionReceipt(config, {
            hash: approvalHash,
            chainId: targetChainId
          });
        }

        setStatus('depositing');
        const depositHash = await writeContract(config, {
          address: input.vaultAddress,
          abi: ERC4626_DEPOSIT_ABI,
          functionName: 'deposit',
          args: [amount, receiver],
          chainId: targetChainId
        });

        setDepositTxHash(depositHash);
        const receipt = await waitForTransactionReceipt(config, {
          hash: depositHash,
          chainId: targetChainId
        });

        if (receipt.status !== 'success') {
          throw new Error('DEPOSIT_TX_REVERTED');
        }

        setStatus('success');
        return {
          depositTxHash: depositHash,
          approveTxHash: approvalHash
        };
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message.includes('User rejected')
              ? 'USER_REJECTED'
              : cause.message
            : 'BUY_FAILED';

        setStatus('error');
        setError(message);
        throw cause instanceof Error ? cause : new Error(message);
      }
    },
    [address, chainId, config, isConnected]
  );

  return {
    buy,
    reset,
    status,
    error,
    depositTxHash,
    approveTxHash,
    isConnected,
    address,
    chainId
  };
}
