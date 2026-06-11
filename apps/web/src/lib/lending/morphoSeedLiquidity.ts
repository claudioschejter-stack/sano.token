/** Target USDC liquidity to seed in a Morpho market for a project (max borrow capacity). */
export function calculateMorphoSeedUsdc(input: {
  totalTokens: number;
  pricePerToken: number;
  lltvBps?: number;
  bufferBps?: number;
}): number {
  const totalTokens = input.totalTokens;
  const pricePerToken = input.pricePerToken;
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  if (!Number.isFinite(pricePerToken) || pricePerToken <= 0) return 0;

  const lltvBpsRaw = input.lltvBps ?? Number(process.env.MORPHO_DEFAULT_LLTV_BPS ?? '6250');
  const lltvBps = Number.isFinite(lltvBpsRaw) && lltvBpsRaw > 0 ? lltvBpsRaw : 6250;

  const bufferBpsRaw = input.bufferBps ?? Number(process.env.MORPHO_SEED_BUFFER_BPS ?? '1000');
  const bufferBps = Number.isFinite(bufferBpsRaw) && bufferBpsRaw >= 0 ? bufferBpsRaw : 1000;

  const projectValueUsd = totalTokens * pricePerToken;
  const maxBorrowUsd = projectValueUsd * (lltvBps / 10_000);
  const seedUsd = maxBorrowUsd * (1 + bufferBps / 10_000);

  return Math.ceil(seedUsd * 100) / 100;
}

export function resolveMorphoSeedUsdcForProject(input: {
  totalTokens: number;
  pricePerToken: number;
  lltvBps?: number;
}): number {
  const manualOverride = Number(process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '0');
  const calculated = calculateMorphoSeedUsdc(input);
  if (Number.isFinite(manualOverride) && manualOverride > 0) {
    return Math.max(manualOverride, calculated);
  }
  return calculated;
}
