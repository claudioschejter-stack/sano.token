import { isAddress } from 'ethers';

export function resolveTreasuryAddress(fallback?: string | null): string | null {
  return process.env.TOKEN_TREASURY_ADDRESS?.trim() || process.env.SANOVA_TREASURY_ADDRESS?.trim() || fallback || null;
}

export function validateTreasuryPolicy(input: {
  deployerAddress?: string | null;
  treasuryAddress?: string | null;
}) {
  const treasuryAddress = resolveTreasuryAddress(input.treasuryAddress);
  const production = process.env.NODE_ENV === 'production';

  if (!treasuryAddress || !isAddress(treasuryAddress)) {
    return {
      ok: !production,
      treasuryAddress,
      message: production
        ? 'TOKEN_TREASURY_ADDRESS es obligatoria en producción.'
        : 'Treasury no configurada; se permite solo fuera de producción.'
    };
  }

  if (
    production &&
    input.deployerAddress &&
    treasuryAddress.toLowerCase() === input.deployerAddress.toLowerCase()
  ) {
    return {
      ok: false,
      treasuryAddress,
      message: 'La treasury no puede ser igual a la deployer en producción.'
    };
  }

  return { ok: true, treasuryAddress, message: 'Treasury separada configurada.' };
}
