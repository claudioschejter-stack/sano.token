export type PreparedTransaction = {
  to: string;
  data: string;
  value: string;
  description: string;
  marketId?: string;
};

export function usdcToBaseUnits(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 1_000_000));
}

export function ethToWei(amountEth: number): bigint {
  return BigInt(Math.round(amountEth * 1e18));
}
