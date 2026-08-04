import { Contract, ContractFactory, JsonRpcProvider, getAddress, isAddress, type Signer } from 'ethers';
import DeliveryOperatorModuleArtifact from './artifacts/SanovaDeliveryOperatorModule.json';
import { SAFE_ABI, execAsSafeOwner } from './safeExec';
import { waitForAutomationTx } from './automationTx';

const MODULE_ABI = DeliveryOperatorModuleArtifact.abi;
const MODULE_BYTECODE = DeliveryOperatorModuleArtifact.bytecode;

export function deliveryOperatorModuleAddress(): string | null {
  const raw = process.env.DELIVERY_OPERATOR_MODULE_ADDRESS?.trim();
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

/**
 * Whether the module can hand `amount` of `vault` to `investor` right now.
 * Mirrors the on-chain guard so callers can fall back before spending gas.
 */
export async function moduleCanDeliver(input: {
  moduleAddress: string;
  vaultAddress: string;
  investorAddress: string;
  amount: bigint;
  operatorAddress: string;
  provider: JsonRpcProvider;
}): Promise<boolean> {
  try {
    const module = new Contract(input.moduleAddress, MODULE_ABI, input.provider);
    const [allowed, isOperator] = await Promise.all([
      module.canDeliver(
        getAddress(input.vaultAddress),
        getAddress(input.investorAddress),
        input.amount
      ) as Promise<boolean>,
      module.isOperator(getAddress(input.operatorAddress)) as Promise<boolean>
    ]);
    return Boolean(allowed && isOperator);
  } catch {
    return false;
  }
}

/** Deliver vault shares through the module, signed by the delivery operator. */
export async function deliverSharesViaModule(input: {
  moduleAddress: string;
  vaultAddress: string;
  investorAddress: string;
  amount: bigint;
  signer: Signer;
}): Promise<string> {
  const module = new Contract(input.moduleAddress, MODULE_ABI, input.signer);
  const tx = await module.deliverShares(
    getAddress(input.vaultAddress),
    getAddress(input.investorAddress),
    input.amount
  );
  const receipt = await waitForAutomationTx(tx);
  return receipt?.hash ?? tx.hash;
}

export type DeliveryModuleSetupStep = {
  step: 'deploy_module' | 'enable_module' | 'allow_vault' | 'set_operator';
  ok: boolean;
  txHash?: string;
  detail?: string;
  error?: string;
};

export type DeliveryModuleSetupResult = {
  safe: string;
  moduleAddress: string | null;
  operatorAddress: string;
  signerAddress: string | null;
  steps: DeliveryModuleSetupStep[];
  /** Paste into Vercel once every step is ok. */
  envToSet: Record<string, string> | null;
};

function stepError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.slice(0, 250) : fallback;
}

/**
 * Wire share delivery so it survives a threshold-2 Safe.
 *
 * The Safe keeps custody and governance; this module lets the delivery
 * operator move shares of allowlisted vaults, and only towards investors the
 * paired asset token has already whitelisted. Every step is idempotent.
 */
export async function setupDeliveryOperatorModule(input: {
  safeAddress: string;
  /** Vault paired with the asset token whose `kycApproved` gates recipients. */
  vaults: Array<{ vaultAddress: string; kycTokenAddress: string; maxPerTx?: bigint }>;
  operatorAddress: string;
  moduleAddress?: string | null;
  rpcUrl?: string;
  /** Safe owner: signs the steps the Safe governs. */
  signer: Signer;
  /**
   * Deploys the module. Contract creation has no recipient, which Privy's
   * transaction API rejects, so a plain key is used when one is available.
   */
  deploySigner?: Signer | null;
}): Promise<DeliveryModuleSetupResult> {
  const safe = getAddress(input.safeAddress);
  const operatorAddress = getAddress(input.operatorAddress);
  const steps: DeliveryModuleSetupStep[] = [];
  let moduleAddress = input.moduleAddress?.trim() || deliveryOperatorModuleAddress();

  const signerAddress = await input.signer.getAddress();
  const provider = input.signer.provider as JsonRpcProvider;

  const safeReader = new Contract(safe, SAFE_ABI, provider);
  const owners = ((await safeReader.getOwners()) as string[]).map((row) => row.toLowerCase());
  if (!owners.includes(signerAddress.toLowerCase())) {
    throw new Error(
      `SIGNER_NOT_SAFE_OWNER:${signerAddress} is not an owner of ${safe} (${owners.join(', ')})`
    );
  }

  if (!moduleAddress) {
    try {
      const factory = new ContractFactory(
        MODULE_ABI,
        MODULE_BYTECODE,
        input.deploySigner ?? input.signer
      );
      const deployed = await factory.deploy(safe);
      await deployed.waitForDeployment();
      moduleAddress = getAddress(await deployed.getAddress());
      steps.push({
        step: 'deploy_module',
        ok: true,
        txHash: deployed.deploymentTransaction()?.hash,
        detail: moduleAddress
      });
    } catch (error) {
      steps.push({ step: 'deploy_module', ok: false, error: stepError(error, 'DEPLOY_FAILED') });
      return { safe, moduleAddress: null, operatorAddress, signerAddress, steps, envToSet: null };
    }
  } else {
    steps.push({ step: 'deploy_module', ok: true, detail: `reused ${moduleAddress}` });
  }

  const safeContract = new Contract(safe, SAFE_ABI, input.signer);
  const module = new Contract(moduleAddress, MODULE_ABI, provider);

  try {
    const already = (await safeContract.isModuleEnabled(moduleAddress)) as boolean;
    if (already) {
      steps.push({ step: 'enable_module', ok: true, detail: 'ALREADY_ENABLED' });
    } else {
      const data = safeContract.interface.encodeFunctionData('enableModule', [moduleAddress]);
      const txHash = await execAsSafeOwner({ safe, signer: input.signer, target: safe, data });
      steps.push({ step: 'enable_module', ok: true, txHash });
    }
  } catch (error) {
    steps.push({ step: 'enable_module', ok: false, error: stepError(error, 'ENABLE_MODULE_FAILED') });
  }

  for (const entry of input.vaults) {
    if (!isAddress(entry.vaultAddress) || !isAddress(entry.kycTokenAddress)) continue;
    const vault = getAddress(entry.vaultAddress);
    const kycToken = getAddress(entry.kycTokenAddress);
    try {
      const current = getAddress((await module.vaultKycToken(vault)) as string);
      if (current === kycToken) {
        steps.push({ step: 'allow_vault', ok: true, detail: `${vault} ALREADY_ALLOWED` });
        continue;
      }
      const data = module.interface.encodeFunctionData('setVaultAllowed', [
        vault,
        kycToken,
        entry.maxPerTx ?? 0n
      ]);
      const txHash = await execAsSafeOwner({
        safe,
        signer: input.signer,
        target: moduleAddress,
        data
      });
      steps.push({ step: 'allow_vault', ok: true, txHash, detail: `${vault} → ${kycToken}` });
    } catch (error) {
      steps.push({
        step: 'allow_vault',
        ok: false,
        detail: vault,
        error: stepError(error, 'ALLOW_VAULT_FAILED')
      });
    }
  }

  try {
    const isOperator = (await module.isOperator(operatorAddress)) as boolean;
    if (isOperator) {
      steps.push({ step: 'set_operator', ok: true, detail: 'ALREADY_OPERATOR' });
    } else {
      const data = module.interface.encodeFunctionData('setOperator', [operatorAddress, true]);
      const txHash = await execAsSafeOwner({
        safe,
        signer: input.signer,
        target: moduleAddress,
        data
      });
      steps.push({ step: 'set_operator', ok: true, txHash, detail: operatorAddress });
    }
  } catch (error) {
    steps.push({ step: 'set_operator', ok: false, error: stepError(error, 'SET_OPERATOR_FAILED') });
  }

  const allOk = steps.every((step) => step.ok);
  return {
    safe,
    moduleAddress,
    operatorAddress,
    signerAddress,
    steps,
    envToSet: allOk && moduleAddress ? { DELIVERY_OPERATOR_MODULE_ADDRESS: moduleAddress } : null
  };
}
