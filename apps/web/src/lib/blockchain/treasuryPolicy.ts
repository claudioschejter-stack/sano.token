import { Contract, JsonRpcProvider, isAddress } from 'ethers';

export function resolveTreasuryAddress(fallback?: string | null): string | null {
  return process.env.TOKEN_TREASURY_ADDRESS?.trim() || process.env.SANOVA_TREASURY_ADDRESS?.trim() || fallback || null;
}

function resolveRpcUrl(): string | null {
  return process.env.BASE_RPC_URL?.trim() ?? process.env.POLYGON_RPC_URL?.trim() ?? null;
}

async function inspectSafeTreasury(treasuryAddress: string) {
  const rpcUrl = resolveRpcUrl();
  if (!rpcUrl) {
    return { ok: false, message: 'No hay RPC configurado para validar si treasury es Safe.' };
  }

  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const code = await provider.getCode(treasuryAddress);
    if (!code || code === '0x') {
      return { ok: false, message: 'Treasury es EOA; en producción debe ser contrato multisig/Safe.' };
    }

    try {
      const safe = new Contract(
        treasuryAddress,
        [
          'function getThreshold() view returns (uint256)',
          'function getOwners() view returns (address[])'
        ],
        provider
      );
      const [threshold, owners] = await Promise.all([safe.getThreshold(), safe.getOwners()]);
      const ownerCount = Array.isArray(owners) ? owners.length : 0;
      const thresholdValue = Number(threshold);
      if (thresholdValue >= 1 && ownerCount >= thresholdValue) {
        return { ok: true, message: `Treasury Safe validada (${thresholdValue}/${ownerCount}).` };
      }
      return { ok: false, message: 'Treasury Safe inválida: threshold/owners inconsistente.' };
    } catch {
      return { ok: true, message: 'Treasury es contrato; no expone ABI Safe estándar.' };
    }
  } finally {
    provider.destroy();
  }
}

export async function validateTreasuryPolicy(input: {
  deployerAddress?: string | null;
  treasuryAddress?: string | null;
}) {
  const treasuryAddress = resolveTreasuryAddress(input.treasuryAddress);
  const production = process.env.NODE_ENV === 'production';
  const allowEoa = process.env.ALLOW_EOA_TREASURY_IN_PRODUCTION === 'true';

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

  if (production && !allowEoa) {
    const safe = await inspectSafeTreasury(treasuryAddress);
    if (!safe.ok) {
      return {
        ok: false,
        treasuryAddress,
        message: safe.message
      };
    }
    return { ok: true, treasuryAddress, message: safe.message };
  }

  return { ok: true, treasuryAddress, message: 'Treasury separada configurada.' };
}
