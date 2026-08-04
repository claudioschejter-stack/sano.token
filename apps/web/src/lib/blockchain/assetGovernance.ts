import { prisma } from '@sanova/database';
import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress, type Signer } from 'ethers';
import { kycOperatorModuleAddress } from './kycOperatorModule';
import KycOperatorModuleArtifact from './artifacts/SanovaKycOperatorModule.json';
import { execAsSafeOwner, isSafeContract, readSafeOwners, readSafeThreshold } from './safeExec';
import { resolveTreasuryOwnerSigner, isTreasuryOwnerSignerConfigured } from './treasuryOwnerSigner';
import { readWithRetry } from './rpcRetry';

const OWNABLE_ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)'
];

const BASE_MAINNET_RPC = 'https://mainnet.base.org';

/** Safe that must own every tokenized asset (multisig for critical actions). */
export function governanceSafeAddress(): string | null {
  const raw =
    process.env.GOVERNANCE_SAFE_ADDRESS?.trim() ||
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
    null;
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

export type ContractGovernance = {
  kind: 'token' | 'vault';
  address: string;
  owner: string | null;
  ownerIsGovernanceSafe: boolean;
  /** Token is scoped in the KYC module (tokens only). */
  moduleAllowed: boolean | null;
};

export type ProjectGovernanceReport = {
  projectId: string;
  title: string;
  contracts: ContractGovernance[];
  compliant: boolean;
  issues: string[];
};

export type GovernanceAudit = {
  governanceSafe: string | null;
  safeOwners: string[];
  safeThreshold: number | null;
  moduleAddress: string | null;
  moduleEnabledOnSafe: boolean | null;
  projects: ProjectGovernanceReport[];
  compliant: boolean;
};

function provider(): JsonRpcProvider {
  return new JsonRpcProvider(process.env.BASE_RPC_URL?.trim() || BASE_MAINNET_RPC);
}

async function readOwner(address: string, rpc: JsonRpcProvider): Promise<string | null> {
  const owner = await readWithRetry(async () => {
    const contract = new Contract(address, OWNABLE_ABI, rpc);
    return getAddress((await contract.owner()) as string);
  });
  return owner;
}

/**
 * Where every tokenized asset stands against the target architecture:
 * governance Safe owns the contracts, the KYC module handles whitelisting.
 */
export async function auditAssetGovernance(projectId?: string): Promise<GovernanceAudit> {
  const safe = governanceSafeAddress();
  const moduleAddress = kycOperatorModuleAddress();
  const rpc = provider();

  try {
    const projects = await prisma.project.findMany({
      where: {
        ...(projectId ? { id: projectId } : {}),
        OR: [{ contractAddress: { not: null } }, { vaultAddress: { not: null } }]
      },
      select: { id: true, title: true, contractAddress: true, vaultAddress: true }
    });

    let safeOwners: string[] = [];
    let safeThreshold: number | null = null;
    let moduleEnabledOnSafe: boolean | null = null;

    if (safe) {
      safeOwners = (await readWithRetry(() => readSafeOwners(safe, rpc))) ?? [];
      safeThreshold = await readWithRetry(() => readSafeThreshold(safe, rpc));
      if (moduleAddress) {
        try {
          const safeContract = new Contract(
            safe,
            ['function isModuleEnabled(address) view returns (bool)'],
            rpc
          );
          moduleEnabledOnSafe = (await safeContract.isModuleEnabled(moduleAddress)) as boolean;
        } catch {
          moduleEnabledOnSafe = null;
        }
      }
    }

    const module = moduleAddress
      ? new Contract(moduleAddress, KycOperatorModuleArtifact.abi, rpc)
      : null;

    const reports: ProjectGovernanceReport[] = [];
    for (const project of projects) {
      const contracts: ContractGovernance[] = [];
      const issues: string[] = [];

      for (const [kind, address] of [
        ['token', project.contractAddress],
        ['vault', project.vaultAddress]
      ] as const) {
        if (!address) continue;
        const owner = await readOwner(address, rpc);
        const ownerIsGovernanceSafe = Boolean(
          safe && owner && owner.toLowerCase() === safe.toLowerCase()
        );

        let moduleAllowed: boolean | null = null;
        if (kind === 'token' && module) {
          moduleAllowed = await module
            .isTokenAllowed(address)
            .then((value: boolean) => Boolean(value))
            .catch(() => null);
        }

        if (!owner) {
          // An unreadable owner is an RPC problem, not a governance problem.
          issues.push(
            `${kind} ${address}: no se pudo leer owner() — el RPC no respondió tras varios intentos`
          );
        } else if (!ownerIsGovernanceSafe) {
          issues.push(`${kind} ${address} owner is ${owner}, expected ${safe}`);
        }
        if (kind === 'token' && moduleAllowed === false) {
          issues.push(`${kind} ${address} is not allowlisted in the KYC module`);
        }

        contracts.push({ kind, address, owner, ownerIsGovernanceSafe, moduleAllowed });
      }

      reports.push({
        projectId: project.id,
        title: project.title,
        contracts,
        compliant: issues.length === 0,
        issues
      });
    }

    if (!safe) {
      reports.forEach((row) => row.issues.push('GOVERNANCE_SAFE_ADDRESS not configured'));
    }

    return {
      governanceSafe: safe,
      safeOwners,
      safeThreshold,
      moduleAddress,
      moduleEnabledOnSafe,
      projects: reports,
      compliant: Boolean(safe) && reports.every((row) => row.compliant)
    };
  } finally {
    rpc.destroy();
  }
}

export type GovernanceFixStep = {
  projectId: string;
  contract: string;
  action: 'transfer_ownership' | 'allow_token_in_module';
  ok: boolean;
  txHash?: string;
  detail?: string;
  error?: string;
};

async function resolveSigners(rpc: JsonRpcProvider): Promise<{
  deployKey: Signer | null;
  safeOwner: Signer | null;
}> {
  const rawKey =
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    null;
  const deployKey = rawKey ? new Wallet(rawKey, rpc) : null;

  let safeOwner: Signer | null = null;
  if (isTreasuryOwnerSignerConfigured()) {
    safeOwner = await resolveTreasuryOwnerSigner(rpc, 8453).catch(() => null);
  }

  return { deployKey, safeOwner };
}

/**
 * Move every asset to the target architecture.
 *
 * Handles both sources of ownership: a plain EOA (legacy deploy key) and a
 * legacy Safe, whose `transferOwnership` must be executed through the Safe.
 */
export async function enforceAssetGovernance(input?: {
  projectId?: string;
  dryRun?: boolean;
}): Promise<{ audit: GovernanceAudit; steps: GovernanceFixStep[] }> {
  const audit = await auditAssetGovernance(input?.projectId);
  const safe = audit.governanceSafe;
  const steps: GovernanceFixStep[] = [];

  if (!safe) {
    return { audit, steps };
  }
  if (input?.dryRun) {
    return { audit, steps };
  }

  const rpc = provider();
  try {
    const { deployKey, safeOwner } = await resolveSigners(rpc);
    const deployAddress = deployKey ? (await deployKey.getAddress()).toLowerCase() : null;
    const safeOwnerAddress = safeOwner ? (await safeOwner.getAddress()).toLowerCase() : null;

    for (const project of audit.projects) {
      for (const contract of project.contracts) {
        // 1. Ownership → governance Safe.
        if (!contract.ownerIsGovernanceSafe && contract.owner) {
          const owner = contract.owner.toLowerCase();
          const ownable = new Contract(contract.address, OWNABLE_ABI, rpc);
          const data = ownable.interface.encodeFunctionData('transferOwnership', [safe]);

          try {
            if (deployAddress && owner === deployAddress && deployKey) {
              const tx = await new Contract(contract.address, OWNABLE_ABI, deployKey).transferOwnership(safe);
              const receipt = await tx.wait();
              steps.push({
                projectId: project.projectId,
                contract: contract.address,
                action: 'transfer_ownership',
                ok: true,
                txHash: receipt?.hash ?? tx.hash,
                detail: `EOA ${contract.owner} → Safe ${safe}`
              });
            } else if (await isSafeContract(contract.owner, rpc)) {
              // Legacy Safe owns it: execute transferOwnership through that Safe.
              const legacyOwners = await readSafeOwners(contract.owner, rpc);
              const signer =
                deployAddress && legacyOwners.includes(deployAddress)
                  ? deployKey
                  : safeOwnerAddress && legacyOwners.includes(safeOwnerAddress)
                    ? safeOwner
                    : null;

              if (!signer) {
                steps.push({
                  projectId: project.projectId,
                  contract: contract.address,
                  action: 'transfer_ownership',
                  ok: false,
                  error: `NO_SIGNER_FOR_LEGACY_SAFE ${contract.owner} (owners: ${legacyOwners.join(', ')})`
                });
                continue;
              }

              const txHash = await execAsSafeOwner({
                safe: contract.owner,
                signer,
                target: contract.address,
                data
              });
              steps.push({
                projectId: project.projectId,
                contract: contract.address,
                action: 'transfer_ownership',
                ok: true,
                txHash,
                detail: `legacy Safe ${contract.owner} → Safe ${safe}`
              });
            } else {
              steps.push({
                projectId: project.projectId,
                contract: contract.address,
                action: 'transfer_ownership',
                ok: false,
                error: `NO_SIGNER_FOR_OWNER ${contract.owner}`
              });
              continue;
            }
          } catch (error) {
            steps.push({
              projectId: project.projectId,
              contract: contract.address,
              action: 'transfer_ownership',
              ok: false,
              error: error instanceof Error ? error.message.slice(0, 250) : 'TRANSFER_FAILED'
            });
            continue;
          }
        }

        // 2. Token scoped in the KYC module.
        if (contract.kind === 'token' && audit.moduleAddress && contract.moduleAllowed === false) {
          if (!safeOwner) {
            steps.push({
              projectId: project.projectId,
              contract: contract.address,
              action: 'allow_token_in_module',
              ok: false,
              error: 'SAFE_OWNER_SIGNER_MISSING: configure PRIVY_SAFE_OWNER_WALLET_ID'
            });
            continue;
          }
          try {
            const module = new Contract(
              audit.moduleAddress,
              KycOperatorModuleArtifact.abi,
              rpc
            );
            const data = module.interface.encodeFunctionData('setTokenAllowed', [
              contract.address,
              true
            ]);
            const txHash = await execAsSafeOwner({
              safe,
              signer: safeOwner,
              target: audit.moduleAddress,
              data
            });
            steps.push({
              projectId: project.projectId,
              contract: contract.address,
              action: 'allow_token_in_module',
              ok: true,
              txHash
            });
          } catch (error) {
            steps.push({
              projectId: project.projectId,
              contract: contract.address,
              action: 'allow_token_in_module',
              ok: false,
              error: error instanceof Error ? error.message.slice(0, 250) : 'ALLOW_TOKEN_FAILED'
            });
          }
        }
      }
    }
  } finally {
    rpc.destroy();
  }

  return { audit: await auditAssetGovernance(input?.projectId), steps };
}
