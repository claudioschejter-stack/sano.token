import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { resolveChainId, resolveMorphoChainId } from '../blockchain/explorerUrls';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import {
  isTreasuryOwnerSignerConfigured,
  resolveTreasuryOwnerAddress
} from '../blockchain/treasuryOwnerSigner';
import {
  isMorphoLiquiditySignerConfigured,
  resolveMorphoLiquidityAddress
} from '../blockchain/morphoLiquiditySigner';
import { privyOperatorWalletId, resolveRwaOperatorAddressEnv } from '../privy/config';
import { auditAssetGovernance, governanceSafeAddress } from '../blockchain/assetGovernance';
import { kycOperatorModuleAddress } from '../blockchain/kycOperatorModule';
import { deliveryOperatorModuleAddress } from '../blockchain/deliveryOperatorModule';
import { locateContracts, type ContractLocation } from '../blockchain/contractChainLocator';
import { readWithRetry } from '../blockchain/rpcRetry';
import { privyApiBase, privyHeaders } from '../privy/privyHttp';
import { readSafeOwners, readSafeThreshold } from '../blockchain/safeExec';
import { usdcDecimals, usdcTokenAddress } from '../payments/paymentConfig';

export type AlignmentSeverity = 'BLOCKER' | 'WARN';

export type AlignmentIssue = {
  section: string;
  code: string;
  severity: AlignmentSeverity;
  detail: string;
  /** Concrete operator action that clears the issue. */
  fix: string;
};

export type WalletRole = {
  role: string;
  purpose: string;
  address: string | null;
  privyWalletId: string | null;
  configured: boolean;
  ethBalance: string | null;
  /** Minimum ETH this role needs to keep signing. */
  minEth: number;
};

export type ProjectSupplyAlignment = {
  projectId: string;
  title: string;
  totalTokens: number;
  availableTokens: number;
  soldFromDb: number;
  investmentTokens: number;
  reservedInOpenBatches: number;
  treasuryShares: string | null;
  aligned: boolean;
  issues: string[];
};

export type PlatformAlignmentReport = {
  generatedAt: string;
  aligned: boolean;
  issues: AlignmentIssue[];
  chain: {
    deployChainId: number;
    morphoChainId: number;
    rpcUrl: string;
    rpcChainId: number | null;
    consistent: boolean;
    /** Where unreadable contracts actually have code. Empty when all reads worked. */
    contractLocations: ContractLocation[];
  };
  wallets: WalletRole[];
  treasury: {
    tokenTreasury: string | null;
    stablecoinTreasury: string | null;
    governanceSafe: string | null;
    sameAddress: boolean;
    isSafe: boolean | null;
    safeOwners: string[];
    safeThreshold: number | null;
    kycModule: string | null;
    deliveryModule: string | null;
    /** Whether the Safe can go to threshold 2 with checkout still automatic. */
    readyForMultisig: boolean;
    usdcBalance: string | null;
  };
  governance: Awaited<ReturnType<typeof auditAssetGovernance>>;
  supply: ProjectSupplyAlignment[];
  ledger: {
    openCartBatches: number;
    settledIntentsWithoutMovement: number;
    movementsRecorded: number;
  };
  legacySecrets: string[];
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function rpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

function normalise(value: string | null | undefined): string | null {
  const raw = value?.trim();
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

async function ethBalance(provider: JsonRpcProvider, address: string | null): Promise<string | null> {
  if (!address) return null;
  try {
    return formatEther(await provider.getBalance(address));
  } catch {
    return null;
  }
}

/** The address that actually signs, which is not always the one in the env. */
async function privyWalletAddress(walletId: string | null): Promise<string | null> {
  if (!walletId) return null;
  try {
    const response = await fetch(`${privyApiBase()}/v1/wallets/${walletId}`, {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { address?: string };
    return normalise(payload.address ?? null);
  } catch {
    return null;
  }
}

/** Wallet roles the platform needs, in the order they block operations. */
function walletRoles(): WalletRole[] {
  return [
    {
      role: 'rwa_operator',
      purpose: 'Despliegue de tokens y vaults, mint, NAV oracle, mercados Morpho',
      address: normalise(resolveRwaOperatorAddressEnv()),
      privyWalletId: privyOperatorWalletId() || null,
      configured: Boolean(privyOperatorWalletId() && resolveRwaOperatorAddressEnv()),
      ethBalance: null,
      minEth: 0.003
    },
    {
      role: 'safe_owner',
      purpose: 'Firma las transacciones del Safe: entrega de shares, módulos, gobernanza',
      address: normalise(resolveTreasuryOwnerAddress()),
      privyWalletId: process.env.PRIVY_SAFE_OWNER_WALLET_ID?.trim() || null,
      configured: isTreasuryOwnerSignerConfigured(),
      ethBalance: null,
      minEth: 0.003
    },
    {
      role: 'morpho_liquidity',
      purpose: 'Supply y withdraw de liquidez en Morpho',
      address: normalise(resolveMorphoLiquidityAddress()),
      privyWalletId: process.env.PRIVY_MORPHO_LIQUIDITY_WALLET_ID?.trim() || null,
      configured: isMorphoLiquiditySignerConfigured(),
      ethBalance: null,
      minEth: 0.002
    },
    {
      role: 'usdc_treasury_signer',
      purpose: 'Paga renta y rendimientos en USDC a los inversores',
      // Resolved from Privy below: the stablecoin treasury may be a Safe, which
      // holds the USDC but never signs and therefore needs no gas.
      address: null,
      privyWalletId: process.env.PRIVY_TREASURY_WALLET_ID?.trim() || null,
      configured: Boolean(process.env.PRIVY_TREASURY_WALLET_ID?.trim()),
      ethBalance: null,
      minEth: 0.001
    }
  ];
}

/** Bare private keys are a liability once every role runs through Privy or the Safe. */
function legacySecrets(): string[] {
  return ['TOKEN_DEPLOY_PRIVATE_KEY', 'TREASURY_OWNER_PRIVATE_KEY', 'PRIVATE_KEY'].filter((name) =>
    Boolean(process.env[name]?.trim())
  );
}

async function auditSupply(provider: JsonRpcProvider): Promise<ProjectSupplyAlignment[]> {
  const treasury = normalise(resolveTreasuryAddress());
  const projects = await prisma.project.findMany({
    where: { OR: [{ contractAddress: { not: null } }, { vaultAddress: { not: null } }] },
    select: {
      id: true,
      title: true,
      totalTokens: true,
      availableTokens: true,
      vaultAddress: true
    }
  });

  const rows: ProjectSupplyAlignment[] = [];

  for (const project of projects) {
    const issues: string[] = [];
    const investments = await prisma.investment.aggregate({
      where: { projectId: project.id, status: 'ACTIVE' },
      _sum: { tokenCount: true }
    });
    const investmentTokens = Number(investments._sum.tokenCount ?? 0);
    const soldFromDb = project.totalTokens - project.availableTokens;

    const reservedInOpenBatches = await prisma.paymentIntent.count({
      where: { projectId: project.id, status: 'REQUIRES_PAYMENT' }
    });

    if (soldFromDb !== investmentTokens) {
      issues.push(
        `Vendidos según cupo (${soldFromDb}) ≠ tokens en inversiones confirmadas (${investmentTokens})`
      );
    }
    if (project.availableTokens < 0) {
      issues.push(`availableTokens negativo (${project.availableTokens}): se sobrevendió el cupo`);
    }
    if (project.availableTokens > project.totalTokens) {
      issues.push('availableTokens supera totalTokens');
    }

    let treasuryShares: string | null = null;
    const vault = normalise(project.vaultAddress);
    if (vault && treasury) {
      try {
        const contract = new Contract(vault, ERC20_ABI, provider);
        const [balance, decimals] = await Promise.all([
          contract.balanceOf(treasury) as Promise<bigint>,
          contract.decimals() as Promise<bigint>
        ]);
        treasuryShares = formatUnits(balance, Number(decimals));
      } catch {
        issues.push('No se pudo leer el balance de shares del treasury en el vault');
      }
    }

    rows.push({
      projectId: project.id,
      title: project.title,
      totalTokens: project.totalTokens,
      availableTokens: project.availableTokens,
      soldFromDb,
      investmentTokens,
      reservedInOpenBatches,
      treasuryShares,
      aligned: issues.length === 0,
      issues
    });
  }

  return rows;
}

async function auditLedger() {
  const [openCartBatches, movementsRecorded] = await Promise.all([
    prisma.paymentIntent.count({ where: { status: 'REQUIRES_PAYMENT' } }).catch(() => 0),
    prisma.tokenMovement.count().catch(() => 0)
  ]);

  const settledIntents = await prisma.paymentIntent
    .findMany({
      where: { status: 'CONFIRMED', txHash: { not: null } },
      select: { txHash: true },
      take: 500
    })
    .catch(() => [] as Array<{ txHash: string | null }>);

  let settledIntentsWithoutMovement = 0;
  if (settledIntents.length > 0) {
    const hashes = settledIntents.map((row) => row.txHash!).filter(Boolean);
    const known = await prisma.tokenMovement
      .findMany({ where: { txHash: { in: hashes } }, select: { txHash: true } })
      .catch(() => [] as Array<{ txHash: string }>);
    const knownSet = new Set(known.map((row) => row.txHash.toLowerCase()));
    settledIntentsWithoutMovement = hashes.filter(
      (hash) => !knownSet.has(hash.toLowerCase())
    ).length;
  }

  return { openCartBatches, settledIntentsWithoutMovement, movementsRecorded };
}

/**
 * One report that answers "is the whole platform aligned?": chain config,
 * every operational wallet, the treasury Safe, contract ownership, token
 * supply against the chain, and the movement ledger.
 *
 * Each finding carries the operator action that clears it, so the runbook is
 * the response itself rather than a separate document that drifts.
 */
export async function auditPlatformAlignment(): Promise<PlatformAlignmentReport> {
  const provider = new JsonRpcProvider(rpcUrl());
  const issues: AlignmentIssue[] = [];

  try {
    const deployChainId = resolveChainId();
    const morphoChainId = resolveMorphoChainId();
    let rpcChainId: number | null = null;
    try {
      rpcChainId = Number((await provider.getNetwork()).chainId);
    } catch {
      rpcChainId = null;
    }

    const chainConsistent =
      rpcChainId !== null && rpcChainId === deployChainId && deployChainId === morphoChainId;

    if (rpcChainId === null) {
      issues.push({
        section: 'chain',
        code: 'RPC_UNREACHABLE',
        severity: 'BLOCKER',
        detail: `No se pudo consultar la red en ${rpcUrl()}`,
        fix: 'Revisá BASE_RPC_URL / LENDING_BASE_RPC_URL en Vercel.'
      });
    } else if (rpcChainId !== deployChainId) {
      issues.push({
        section: 'chain',
        code: 'RPC_CHAIN_MISMATCH',
        severity: 'BLOCKER',
        detail: `El RPC responde chainId ${rpcChainId} pero TOKEN_DEPLOY_CHAIN_ID es ${deployChainId}`,
        fix: `Alineá BASE_RPC_URL con la red ${deployChainId}, o corregí TOKEN_DEPLOY_CHAIN_ID.`
      });
    }

    if (morphoChainId !== deployChainId) {
      issues.push({
        section: 'chain',
        code: 'MORPHO_CHAIN_MISMATCH',
        severity: 'WARN',
        detail: `Morpho opera en ${morphoChainId} y los tokens se despliegan en ${deployChainId}`,
        fix: 'Igualá MORPHO_CHAIN_ID a TOKEN_DEPLOY_CHAIN_ID salvo que sea intencional.'
      });
    }

    const wallets = walletRoles();
    for (const wallet of wallets) {
      wallet.address = (await privyWalletAddress(wallet.privyWalletId)) ?? wallet.address;
      wallet.ethBalance = await ethBalance(provider, wallet.address);

      if (!wallet.configured) {
        issues.push({
          section: 'wallets',
          code: `WALLET_NOT_CONFIGURED:${wallet.role}`,
          severity: 'BLOCKER',
          detail: `El rol ${wallet.role} (${wallet.purpose}) no tiene wallet configurada`,
          fix: `Definí el wallet id de Privy y la dirección del rol ${wallet.role} en Vercel.`
        });
        continue;
      }

      const balance = wallet.ethBalance === null ? null : Number(wallet.ethBalance);
      if (balance !== null && balance < wallet.minEth) {
        issues.push({
          section: 'wallets',
          code: `WALLET_LOW_GAS:${wallet.role}`,
          severity: balance === 0 ? 'BLOCKER' : 'WARN',
          detail: `${wallet.role} (${wallet.address}) tiene ${wallet.ethBalance} ETH`,
          fix: `Fondeá ${wallet.address} con al menos ${wallet.minEth} ETH en la red ${deployChainId}.`
        });
      }
    }

    const tokenTreasury = normalise(resolveTreasuryAddress());
    const stablecoinTreasury = normalise(
      process.env.BASE_STABLECOIN_TREASURY_ADDRESS || process.env.STABLECOIN_TREASURY_ADDRESS
    );
    const safe = governanceSafeAddress();

    let safeOwners: string[] = [];
    let safeThreshold: number | null = null;
    let isSafe: boolean | null = null;
    if (safe) {
      safeOwners = (await readWithRetry(() => readSafeOwners(safe, provider))) ?? [];
      safeThreshold = await readWithRetry(() => readSafeThreshold(safe, provider));
      isSafe = safeThreshold !== null;
    }

    if (!safe) {
      issues.push({
        section: 'treasury',
        code: 'GOVERNANCE_SAFE_MISSING',
        severity: 'BLOCKER',
        detail: 'No hay Safe de gobernanza configurado',
        fix: 'Definí GOVERNANCE_SAFE_ADDRESS con el Safe que debe ser owner de los contratos.'
      });
    } else if (isSafe === false) {
      issues.push({
        section: 'treasury',
        code: 'GOVERNANCE_SAFE_NOT_A_SAFE',
        severity: 'BLOCKER',
        detail: `${safe} no responde como Safe: es una EOA o un contrato distinto`,
        fix: 'Apuntá GOVERNANCE_SAFE_ADDRESS a un Safe real en esta red.'
      });
    }

    const ownerAddress = normalise(resolveTreasuryOwnerAddress());
    if (safe && isSafe && ownerAddress && !safeOwners.includes(ownerAddress.toLowerCase())) {
      issues.push({
        section: 'treasury',
        code: 'SIGNER_NOT_SAFE_OWNER',
        severity: 'BLOCKER',
        detail: `La wallet firmante ${ownerAddress} no es owner del Safe ${safe}`,
        fix: `Agregá ${ownerAddress} como owner del Safe, o apuntá TREASURY_OWNER_ADDRESS a un owner existente.`
      });
    }

    if (tokenTreasury && stablecoinTreasury && tokenTreasury !== stablecoinTreasury) {
      issues.push({
        section: 'treasury',
        code: 'TREASURY_SPLIT',
        severity: 'WARN',
        detail: `Los shares viven en ${tokenTreasury} y el USDC entra en ${stablecoinTreasury}`,
        fix: 'Es válido tener dos tesorerías, pero ambas deben ser Safes de la misma gobernanza.'
      });
    }

    const kycModule = kycOperatorModuleAddress();
    if (!kycModule) {
      issues.push({
        section: 'treasury',
        code: 'KYC_MODULE_MISSING',
        severity: 'WARN',
        detail: 'No hay módulo de KYC: el allowlisting depende de que el operador sea owner',
        fix: 'Desplegá y habilitá el módulo con POST /api/admin/kyc-module-setup.'
      });
    }

    const deliveryModule = deliveryOperatorModuleAddress();
    if (!deliveryModule) {
      issues.push({
        section: 'treasury',
        code: 'DELIVERY_MODULE_MISSING',
        severity: 'WARN',
        detail:
          'La entrega de shares depende de firmar con el Safe, así que subirlo a threshold 2 dejaría cada compra esperando una firma manual',
        fix: 'Desplegá el módulo de entrega con POST /api/admin/delivery-module-setup antes de subir el threshold.'
      });
    }

    /**
     * The whole point of the modules is that the Safe can be closed without
     * putting a manual signature inside checkout.
     */
    const automationReady = Boolean(kycModule && deliveryModule);
    if (safeThreshold !== null && safeThreshold > 1 && !automationReady) {
      issues.push({
        section: 'treasury',
        code: 'THRESHOLD_BLOCKS_AUTOMATION',
        severity: 'BLOCKER',
        detail: `El Safe está en threshold ${safeThreshold} y falta ${kycModule ? 'el módulo de entrega' : 'el módulo de KYC'}: el checkout no puede completarse solo`,
        fix: 'Desplegá los módulos faltantes, o bajá el Safe a threshold 1 hasta tenerlos.'
      });
    }

    let usdcBalance: string | null = null;
    const usdc = usdcTokenAddress();
    if (usdc && stablecoinTreasury) {
      try {
        const contract = new Contract(usdc, ERC20_ABI, provider);
        const raw = (await contract.balanceOf(stablecoinTreasury)) as bigint;
        usdcBalance = formatUnits(raw, usdcDecimals());
      } catch {
        usdcBalance = null;
      }
    }

    const governance = await auditAssetGovernance();

    /**
     * Every on-chain read failing at once usually means the RPC is on another
     * chain, not that the contracts are broken. Locate them before blaming
     * ownership, so the report names the real problem.
     */
    const unreadable: Array<{ address: string; label: string }> = [];
    for (const project of governance.projects) {
      for (const contract of project.contracts) {
        if (!contract.owner) {
          unreadable.push({ address: contract.address, label: `${project.title} (${contract.kind})` });
        }
      }
    }
    if (safe && isSafe === false) {
      unreadable.push({ address: safe, label: 'Governance Safe' });
    }

    const contractLocations = unreadable.length ? await locateContracts(unreadable) : [];
    const elsewhere = contractLocations.filter(
      (row) => row.foundOn.length > 0 && !row.foundOn.some((hit) => hit.chainId === deployChainId)
    );
    const nowhere = contractLocations.filter((row) => row.foundOn.length === 0);
    const throttled = contractLocations.filter((row) =>
      row.foundOn.some((hit) => hit.chainId === deployChainId)
    );

    /**
     * The contract is right here, on the chain we are querying, and we still
     * could not read it: the endpoint is rate limiting us. Saying so is the
     * difference between one fixable problem and a page of phantom ones.
     */
    if (throttled.length) {
      issues.push({
        section: 'chain',
        code: 'RPC_UNRELIABLE',
        severity: 'BLOCKER',
        detail: `${throttled.length} contrato(s) existen en la red ${deployChainId} pero el RPC no respondió a sus lecturas: ${rpcUrl()} está limitando las consultas`,
        fix: 'Usá un RPC dedicado con API key (Alchemy, QuickNode, Infura) en BASE_RPC_URL. El endpoint público no soporta esta carga, y todo lo que figure como owner ilegible es consecuencia de esto.'
      });
    }

    if (elsewhere.length) {
      const chainNames = [
        ...new Set(elsewhere.flatMap((row) => row.foundOn.map((hit) => `${hit.name} (${hit.chainId})`)))
      ];
      issues.push({
        section: 'chain',
        code: 'CONTRACTS_ON_ANOTHER_CHAIN',
        severity: 'BLOCKER',
        detail: `${elsewhere.length} contrato(s) no existen en la red ${deployChainId}: viven en ${chainNames.join(', ')}`,
        fix: `Apuntá BASE_RPC_URL y TOKEN_DEPLOY_CHAIN_ID a ${chainNames[0]}, o volvé a desplegar los activos en la red ${deployChainId}. Todo lo demás que figura como "owner is unknown" es consecuencia de esto.`
      });
    }
    if (nowhere.length) {
      issues.push({
        section: 'chain',
        code: 'CONTRACTS_NOT_FOUND_ANYWHERE',
        severity: 'BLOCKER',
        detail: `${nowhere.length} dirección(es) sin código en ninguna red consultada: ${nowhere.map((row) => row.label).join(', ')}`,
        fix: 'Verificá las direcciones guardadas en la base: puede que el deploy nunca se haya confirmado.'
      });
    }

    /**
     * Ownership cannot be judged from a chain the contracts do not live on, and
     * reporting each failed read as its own problem buries the one that matters.
     */
    const chainMisreads = elsewhere.length > 0 || nowhere.length > 0 || throttled.length > 0;
    if (chainMisreads) {
      const consequences = new Set(['GOVERNANCE_SAFE_NOT_A_SAFE', 'SIGNER_NOT_SAFE_OWNER']);
      for (let index = issues.length - 1; index >= 0; index -= 1) {
        if (consequences.has(issues[index].code)) {
          issues.splice(index, 1);
        }
      }
    }

    if (!governance.compliant && !chainMisreads) {
      for (const project of governance.projects) {
        for (const detail of project.issues) {
          issues.push({
            section: 'governance',
            code: 'ASSET_NOT_UNDER_SAFE',
            severity: 'BLOCKER',
            detail: `${project.title}: ${detail}`,
            fix: 'Ejecutá POST /api/admin/asset-governance para migrar el activo al Safe.'
          });
        }
      }
    }

    const supply = await auditSupply(provider);
    for (const project of supply) {
      for (const detail of project.issues) {
        // A share balance that cannot be read on the wrong chain says nothing
        // about the cupo, so it must not surface as a supply problem.
        if (chainMisreads && detail.includes('balance de shares')) {
          continue;
        }
        issues.push({
          section: 'supply',
          code: 'SUPPLY_MISMATCH',
          severity: 'WARN',
          detail: `${project.title}: ${detail}`,
          fix: 'Revisá el proyecto en /api/admin/token-reconciliation y corregí el cupo.'
        });
      }
    }

    const ledger = await auditLedger();
    if (ledger.settledIntentsWithoutMovement > 0) {
      issues.push({
        section: 'ledger',
        code: 'MOVEMENTS_MISSING',
        severity: 'WARN',
        detail: `${ledger.settledIntentsWithoutMovement} pagos liquidados sin movimiento en la bitácora`,
        fix: 'Corré el indexador de movimientos para completar la bitácora.'
      });
    }

    const secrets = legacySecrets();
    for (const name of secrets) {
      issues.push({
        section: 'secrets',
        code: 'LEGACY_PRIVATE_KEY',
        severity: 'WARN',
        detail: `${name} sigue presente en el entorno`,
        fix: `Borrá ${name} de Vercel una vez que la gobernanza esté en el Safe.`
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      aligned: issues.every((issue) => issue.severity !== 'BLOCKER'),
      issues,
      chain: {
        deployChainId,
        morphoChainId,
        rpcUrl: rpcUrl(),
        rpcChainId,
        consistent: chainConsistent,
        contractLocations
      },
      wallets,
      treasury: {
        tokenTreasury,
        stablecoinTreasury,
        governanceSafe: safe,
        sameAddress: Boolean(
          tokenTreasury && stablecoinTreasury && tokenTreasury === stablecoinTreasury
        ),
        isSafe,
        safeOwners,
        safeThreshold,
        kycModule,
        deliveryModule,
        readyForMultisig: automationReady,
        usdcBalance
      },
      governance,
      supply,
      ledger,
      legacySecrets: secrets
    };
  } finally {
    provider.destroy();
  }
}
