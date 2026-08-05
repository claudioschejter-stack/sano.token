import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress, type Signer } from 'ethers';
import KycOperatorModuleArtifact from './artifacts/SanovaKycOperatorModule.json';
import { buildSafePreValidatedSignature } from './safePreValidatedSignature';

const SAFE_ABI = [
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) payable returns (bool success)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function enableModule(address module)',
  'function isModuleEnabled(address module) view returns (bool)'
];

const MODULE_ABI = KycOperatorModuleArtifact.abi;
const MODULE_BYTECODE = KycOperatorModuleArtifact.bytecode;

export function kycOperatorModuleAddress(): string | null {
  const raw = process.env.KYC_OPERATOR_MODULE_ADDRESS?.trim();
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

/** Whether this module can whitelist on a token right now. */
export async function moduleCanWhitelist(input: {
  moduleAddress: string;
  tokenAddress: string;
  operatorAddress: string;
  provider: JsonRpcProvider;
}): Promise<boolean> {
  try {
    const module = new Contract(input.moduleAddress, MODULE_ABI, input.provider);
    const [tokenAllowed, operatorAllowed] = await Promise.all([
      module.isTokenAllowed(input.tokenAddress) as Promise<boolean>,
      module.isOperator(input.operatorAddress) as Promise<boolean>
    ]);
    return Boolean(tokenAllowed && operatorAllowed);
  } catch {
    return false;
  }
}

/**
 * Whether this module can also start the token's KYC timelock.
 *
 * Modules deployed before `scheduleKyc` existed cannot, and for those the Safe
 * has to schedule — which stops being automatic at threshold 2.
 */
export async function moduleCanSchedule(input: {
  moduleAddress: string;
  provider: JsonRpcProvider;
}): Promise<boolean> {
  try {
    const module = new Contract(input.moduleAddress, MODULE_ABI, input.provider);
    // Present only on modules that carry scheduling.
    await module.kycActionId('0x0000000000000000000000000000000000000001', true);
    return true;
  } catch {
    return false;
  }
}

/** Start the token's KYC timelock through the module, signed by the operator. */
export async function scheduleKycViaModule(input: {
  moduleAddress: string;
  tokenAddress: string;
  investorAddress: string;
  approved: boolean;
  signer: Signer;
}): Promise<string> {
  const module = new Contract(input.moduleAddress, MODULE_ABI, input.signer);
  const tx = await module.scheduleKyc(
    getAddress(input.tokenAddress),
    getAddress(input.investorAddress),
    input.approved
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/** `setKyc` through the module, signed by the compliance operator. */
export async function setKycViaModule(input: {
  moduleAddress: string;
  tokenAddress: string;
  investorAddress: string;
  approved: boolean;
  signer: Signer;
}): Promise<string> {
  const module = new Contract(input.moduleAddress, MODULE_ABI, input.signer);
  const tx = await module.setKyc(
    getAddress(input.tokenAddress),
    getAddress(input.investorAddress),
    input.approved
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/** Execute `data` on `target` as the Safe, using a threshold-1 owner signature. */
async function execAsSafe(input: {
  safe: string;
  signer: Signer;
  target: string;
  data: string;
}): Promise<string> {
  const signerAddress = await input.signer.getAddress();
  const safe = new Contract(input.safe, SAFE_ABI, input.signer);

  const owners = ((await safe.getOwners()) as string[]).map((row) => row.toLowerCase());
  if (!owners.includes(signerAddress.toLowerCase())) {
    throw new Error(`SIGNER_NOT_SAFE_OWNER:${signerAddress}`);
  }

  const threshold = Number((await safe.getThreshold()) as bigint);
  if (threshold > 1) {
    throw new Error(
      `SAFE_THRESHOLD_${threshold}: collect ${threshold} signatures in the Safe UI for this step`
    );
  }

  const tx = await safe.execTransaction(
    input.target,
    0,
    input.data,
    0,
    0,
    0,
    0,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    buildSafePreValidatedSignature(signerAddress)
  );
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export type KycModuleSetupStep = {
  step:
    | 'deploy_module'
    | 'enable_module'
    | 'allow_token'
    | 'set_operator';
  ok: boolean;
  txHash?: string;
  detail?: string;
  error?: string;
};

export type KycModuleSetupResult = {
  safe: string;
  moduleAddress: string | null;
  operatorAddress: string;
  signerAddress: string | null;
  steps: KycModuleSetupStep[];
  /** Paste into Vercel once every step is ok. */
  envToSet: Record<string, string> | null;
};

/**
 * Wire the two-tier authority: the Safe keeps token ownership (mint, pause,
 * ownership) and this module lets the compliance operator call only `setKyc`.
 *
 * Signed with the Safe owner key; every step is idempotent.
 */
export async function setupKycOperatorModule(input: {
  safeAddress: string;
  tokenAddresses: string[];
  operatorAddress: string;
  /** Reuse an already deployed module instead of deploying a new one. */
  moduleAddress?: string | null;
  rpcUrl?: string;
  privateKey?: string | null;
}): Promise<KycModuleSetupResult> {
  const safe = getAddress(input.safeAddress);
  const operatorAddress = getAddress(input.operatorAddress);
  const privateKey =
    input.privateKey?.trim() ||
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    null;

  const provider = new JsonRpcProvider(
    input.rpcUrl?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'
  );
  const steps: KycModuleSetupStep[] = [];
  let moduleAddress = input.moduleAddress?.trim() || kycOperatorModuleAddress();
  let signerAddress: string | null = null;

  try {
    /**
     * Deploying only needs gas; the Safe steps need an **owner** signature.
     * The legacy deploy key is usually not a Safe owner, so those steps are
     * signed by the Privy Safe-owner wallet instead.
     */
    const deploySigner = privateKey ? new Wallet(privateKey, provider) : null;

    const { resolveTreasuryOwnerSigner, isTreasuryOwnerSignerConfigured } = await import(
      './treasuryOwnerSigner'
    );
    const safeReader = new Contract(safe, SAFE_ABI, provider);
    const owners = ((await safeReader.getOwners()) as string[]).map((row) => row.toLowerCase());

    let safeSigner: Signer | null = null;
    if (deploySigner) {
      const deployAddress = (await deploySigner.getAddress()).toLowerCase();
      if (owners.includes(deployAddress)) {
        safeSigner = deploySigner;
      }
    }
    if (!safeSigner && isTreasuryOwnerSignerConfigured()) {
      const privySigner = await resolveTreasuryOwnerSigner(provider, 8453);
      const privyAddress = privySigner ? (await privySigner.getAddress()).toLowerCase() : null;
      if (privySigner && privyAddress && owners.includes(privyAddress)) {
        safeSigner = privySigner;
      }
    }

    if (!deploySigner && !safeSigner) {
      throw new Error(
        `SAFE_OWNER_SIGNER_MISSING: configure PRIVY_SAFE_OWNER_WALLET_ID + TREASURY_OWNER_ADDRESS for a Safe owner (${owners.join(', ')})`
      );
    }

    const signer = deploySigner ?? safeSigner!;
    signerAddress = await signer.getAddress();

    if (!moduleAddress) {
      try {
        const factory = new (await import('ethers')).ContractFactory(
          MODULE_ABI,
          MODULE_BYTECODE,
          signer
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
        steps.push({
          step: 'deploy_module',
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 250) : 'DEPLOY_FAILED'
        });
        return { safe, moduleAddress: null, operatorAddress, signerAddress, steps, envToSet: null };
      }
    } else {
      steps.push({ step: 'deploy_module', ok: true, detail: `reused ${moduleAddress}` });
    }

    if (!safeSigner) {
      const missing = 'SAFE_OWNER_SIGNER_MISSING';
      for (const step of ['enable_module', 'allow_token', 'set_operator'] as const) {
        steps.push({
          step,
          ok: false,
          error: `${missing}: signer ${signerAddress} is not a Safe owner (${owners.join(', ')}). Configure PRIVY_SAFE_OWNER_WALLET_ID + TREASURY_OWNER_ADDRESS.`
        });
      }
      return { safe, moduleAddress, operatorAddress, signerAddress, steps, envToSet: null };
    }

    // Safe-governed steps must be signed by an owner, not the deploy key.
    const safeContract = new Contract(safe, SAFE_ABI, safeSigner);
    const moduleIface = new Contract(moduleAddress, MODULE_ABI, provider);
    signerAddress = await safeSigner.getAddress();

    // 1. Let the module act for the Safe.
    try {
      const already = (await safeContract.isModuleEnabled(moduleAddress)) as boolean;
      if (already) {
        steps.push({ step: 'enable_module', ok: true, detail: 'ALREADY_ENABLED' });
      } else {
        const data = safeContract.interface.encodeFunctionData('enableModule', [moduleAddress]);
        const txHash = await execAsSafe({ safe, signer: safeSigner, target: safe, data });
        steps.push({ step: 'enable_module', ok: true, txHash });
      }
    } catch (error) {
      steps.push({
        step: 'enable_module',
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 250) : 'ENABLE_MODULE_FAILED'
      });
    }

    // 2. Scope the module to the project's tokens.
    for (const rawToken of input.tokenAddresses) {
      if (!isAddress(rawToken)) continue;
      const token = getAddress(rawToken);
      try {
        const allowed = (await moduleIface.isTokenAllowed(token)) as boolean;
        if (allowed) {
          steps.push({ step: 'allow_token', ok: true, detail: `${token} ALREADY_ALLOWED` });
          continue;
        }
        const data = moduleIface.interface.encodeFunctionData('setTokenAllowed', [token, true]);
        const txHash = await execAsSafe({ safe, signer: safeSigner, target: moduleAddress, data });
        steps.push({ step: 'allow_token', ok: true, txHash, detail: token });
      } catch (error) {
        steps.push({
          step: 'allow_token',
          ok: false,
          detail: token,
          error: error instanceof Error ? error.message.slice(0, 250) : 'ALLOW_TOKEN_FAILED'
        });
      }
    }

    // 3. Grant whitelisting rights to the compliance operator.
    try {
      const isOperator = (await moduleIface.isOperator(operatorAddress)) as boolean;
      if (isOperator) {
        steps.push({ step: 'set_operator', ok: true, detail: 'ALREADY_OPERATOR' });
      } else {
        const data = moduleIface.interface.encodeFunctionData('setOperator', [
          operatorAddress,
          true
        ]);
        const txHash = await execAsSafe({ safe, signer: safeSigner, target: moduleAddress, data });
        steps.push({ step: 'set_operator', ok: true, txHash, detail: operatorAddress });
      }
    } catch (error) {
      steps.push({
        step: 'set_operator',
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 250) : 'SET_OPERATOR_FAILED'
      });
    }
  } finally {
    provider.destroy();
  }

  const allOk = steps.every((step) => step.ok);
  return {
    safe,
    moduleAddress,
    operatorAddress,
    signerAddress,
    steps,
    envToSet: allOk && moduleAddress ? { KYC_OPERATOR_MODULE_ADDRESS: moduleAddress } : null
  };
}
