import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  concat,
  formatUnits,
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  toUtf8Bytes
} from 'ethers';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { appendDeploymentEvent, getAdminAsset, updateAdminAsset } from '../admin/assetsService';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveChainId } from './explorerUrls';
import { execAsOwner } from './safeExec';
import { readWithRetry } from './rpcRetry';
import { readVaultShareDecimals, vaultSharesForTokens } from './vaultShareUnits';
import { confirmOnChain } from './confirmOnChain';
import { ensureVaultRecipientAllowed, setVaultAdminDelay } from './vaultRecipientAllowlist';
import { setInvestorKycAllowlist } from './kycAllowlist';
import { readKycTimelock, scheduleTokenKyc } from './scheduleTokenKyc';
import {
  deliveryOperatorModuleAddress,
  setupDeliveryOperatorModule
} from './deliveryOperatorModule';

/**
 * Move a project onto a vault built from the corrected contract.
 *
 * The deployed vaults reject any recipient carrying code unless it is explicitly
 * allowlisted, and every Privy wallet carries an EIP-7702 delegation — so each
 * investor's first purchase hits a timelocked allowance. The contract now only
 * asks that of addresses KYC has not cleared, but a deployed contract cannot be
 * changed: the project has to move to a new one.
 *
 * It is a multi-day operation, because letting the new vault hold the asset
 * token is itself timelocked on the old token. So this is a state machine that
 * reports where it stands and does whatever step is available, and is meant to
 * be called repeatedly rather than run once.
 *
 * Only safe while the treasury is the sole shareholder. Once an investor holds
 * shares of the old vault, migrating means moving their balance too, and that is
 * a different, riskier operation this refuses to attempt.
 */

const VAULT_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function asset() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function previewRedeem(uint256) view returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)'
];

const TOKEN_ABI = [
  'function kycApproved(address) view returns (bool)',
  'function externalContractAllowed(address) view returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)'
];

const STATE_EXTERNAL_ID = 'VAULT_MIGRATION_NEW_VAULT';

/**
 * Arachnid's deterministic deployment proxy, present on Base and most EVM
 * chains. Send it a 32-byte salt followed by the init code and it deploys via
 * CREATE2.
 *
 * This is what lets the Safe deploy the vault itself. Contract creation carries
 * no recipient and Privy rejects those, which used to mean the one remaining
 * step that needed a bare private key — the exact thing this whole architecture
 * is trying to retire. Calling the proxy is an ordinary transaction with a
 * recipient, so it goes through the Safe like everything else, and the address
 * is known before it exists.
 */
const CREATE2_DEPLOYER = getAddress('0x4e59b44847b379578588920cA78FbF26c0B4956C');

async function deployReplacementVault(input: {
  provider: JsonRpcProvider;
  signer: Awaited<ReturnType<typeof resolveTreasuryOwnerSigner>>;
  treasury: string;
  token: string;
  name: string;
  symbol: string;
  projectId: string;
}): Promise<{ address: string; txHash: string | null; via: string }> {
  const factory = new ContractFactory(
    SanovaRwaVaultArtifact.abi,
    SanovaRwaVaultArtifact.bytecode
  );
  const deployTx = await factory.getDeployTransaction(
    input.token,
    input.name,
    input.symbol,
    input.treasury
  );
  const initCode = deployTx.data as string;
  const salt = keccak256(toUtf8Bytes(`SANOVA_VAULT_MIGRATION:${input.projectId}`));
  const predicted = getCreate2Address(CREATE2_DEPLOYER, salt, keccak256(initCode));

  // Deterministic, so a repeated run finds its own earlier deployment.
  const already = await input.provider.getCode(predicted).catch(() => '0x');
  if (already && already !== '0x') {
    return { address: predicted, txHash: null, via: 'create2_ya_desplegado' };
  }

  const factoryCode = await input.provider.getCode(CREATE2_DEPLOYER).catch(() => '0x');
  if (factoryCode && factoryCode !== '0x' && input.signer) {
    const txHash = await execAsOwner({
      owner: input.treasury,
      signer: input.signer,
      target: CREATE2_DEPLOYER,
      data: concat([salt, initCode])
    });
    const after = await input.provider.getCode(predicted).catch(() => '0x');
    if (!after || after === '0x') {
      throw new Error(`CREATE2_SIN_CODIGO: la transacción ${txHash} no dejó código en ${predicted}`);
    }
    return { address: predicted, txHash, via: 'create2_desde_safe' };
  }

  /**
   * Only if the chain has no CREATE2 proxy: a bare key sending the creation
   * transaction directly.
   */
  const deployKey =
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    null;
  if (!deployKey) {
    throw new Error(
      'DEPLOYER_NO_DISPONIBLE: no hay proxy CREATE2 en esta red ni TOKEN_DEPLOY_PRIVATE_KEY configurada'
    );
  }

  const keyed = new ContractFactory(
    SanovaRwaVaultArtifact.abi,
    SanovaRwaVaultArtifact.bytecode,
    new Wallet(deployKey, input.provider)
  );
  const deployed = await keyed.deploy(input.token, input.name, input.symbol, input.treasury);
  await deployed.waitForDeployment();
  return {
    address: getAddress(await deployed.getAddress()),
    txHash: deployed.deploymentTransaction()?.hash ?? null,
    via: 'clave_de_despliegue'
  };
}

export type MigrationStepStatus = 'OK' | 'PENDING' | 'BLOCKED' | 'SKIPPED';

export type MigrationStep = {
  step: string;
  status: MigrationStepStatus;
  detail: string;
  txHash?: string;
};

export type VaultMigrationReport = {
  projectId: string;
  projectTitle: string;
  tokenAddress: string | null;
  oldVault: string | null;
  newVault: string | null;
  /** What the operator has to do next, in words. */
  nextAction: string;
  done: boolean;
  steps: MigrationStep[];
};

function rpcUrl(): string {
  return (
    process.env.BASE_RPC_URL?.trim() ||
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

/** The new vault address survives between calls in the deployment log. */
async function readRecordedNewVault(projectId: string): Promise<string | null> {
  const asset = await getAdminAsset(projectId);
  const event = asset?.deploymentEvents.find(
    (row) => row.externalId === STATE_EXTERNAL_ID && row.status !== 'FAILED'
  );
  const address = event?.address?.trim();
  return address && isAddress(address) ? getAddress(address) : null;
}

async function recordNewVault(input: {
  projectId: string;
  address: string;
  txHash?: string | null;
}) {
  await appendDeploymentEvent(input.projectId, {
    step: 'VAULT_DEPLOY',
    status: 'SUCCESS',
    message: 'Vault de reemplazo desplegado con el contrato corregido.',
    address: input.address,
    txHash: input.txHash ?? null,
    externalId: STATE_EXTERNAL_ID
  });
}

export async function advanceVaultMigration(input: {
  projectId: string;
  /** Report the plan without sending a single transaction. */
  dryRun?: boolean;
  /** Proceed even when a Morpho market references the old vault. */
  force?: boolean;
}): Promise<VaultMigrationReport> {
  const steps: MigrationStep[] = [];
  const asset = await getAdminAsset(input.projectId);

  if (!asset) {
    return {
      projectId: input.projectId,
      projectTitle: input.projectId,
      tokenAddress: null,
      oldVault: null,
      newVault: null,
      nextAction: 'El proyecto no existe.',
      done: false,
      steps: [{ step: 'project', status: 'BLOCKED', detail: 'PROJECT_NOT_FOUND' }]
    };
  }

  const token = asset.contractAddress?.trim() ?? null;
  const oldVault = asset.vaultAddress?.trim() ?? null;
  const treasury = resolveTreasuryAddress();
  let newVault = await readRecordedNewVault(input.projectId);

  const finish = (nextAction: string, done = false): VaultMigrationReport => ({
    projectId: asset.id,
    projectTitle: asset.title,
    tokenAddress: token,
    oldVault,
    newVault,
    nextAction,
    done,
    steps
  });

  if (!token || !oldVault || !treasury) {
    steps.push({
      step: 'prechecks',
      status: 'BLOCKED',
      detail: `token=${token ?? 'falta'} vault=${oldVault ?? 'falta'} tesorería=${treasury ?? 'falta'}`
    });
    return finish('Faltan direcciones básicas del activo.');
  }

  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(rpcUrl());

  try {
    const oldVaultContract = new Contract(oldVault, VAULT_ABI, provider);
    const tokenContract = new Contract(token, TOKEN_ABI, provider);

    const [totalSupply, treasuryShares, oldDecimals] = await Promise.all([
      readWithRetry(() => oldVaultContract.totalSupply() as Promise<bigint>),
      readWithRetry(() => oldVaultContract.balanceOf(treasury) as Promise<bigint>),
      readVaultShareDecimals({ provider, vaultAddress: oldVault })
    ]);

    if (totalSupply === null || treasuryShares === null || oldDecimals === null) {
      steps.push({
        step: 'prechecks',
        status: 'BLOCKED',
        detail: 'no se pudo leer el vault actual; el RPC no respondió'
      });
      return finish('Reintentá: el RPC no respondió las lecturas del vault.');
    }

    /**
     * The whole plan rests on nobody but the treasury holding shares. Migrating
     * an investor's balance is a different operation, and doing it by accident
     * would move somebody else's property.
     */
    if (totalSupply !== treasuryShares) {
      const outside = totalSupply - treasuryShares;
      steps.push({
        step: 'prechecks',
        status: 'BLOCKED',
        detail: `hay ${formatUnits(outside, oldDecimals)} shares fuera de la tesorería: la migración movería propiedad de un inversor`
      });
      return finish(
        'No migres: alguien más ya tiene shares de este vault. Hace falta un plan que mueva también su tenencia.'
      );
    }

    steps.push({
      step: 'prechecks',
      status: 'OK',
      detail: `la tesorería es la única tenedora: ${formatUnits(treasuryShares, oldDecimals)} shares (${oldDecimals} decimales)`
    });

    const morpho = asset.collateralTargets.find(
      (target) => target.protocol === 'MORPHO' && target.status === 'REGISTERED'
    );
    if (morpho && !input.force) {
      steps.push({
        step: 'morpho',
        status: 'BLOCKED',
        detail: `hay un mercado Morpho registrado (${morpho.externalId ?? 'sin id'}) atado a este colateral`
      });
      return finish(
        'El mercado de Morpho quedaría apuntando al vault viejo. Resolvelo primero, o repetí con force para migrar igual.'
      );
    }
    steps.push({
      step: 'morpho',
      status: morpho ? 'SKIPPED' : 'OK',
      detail: morpho ? 'forzado: revisá el mercado después' : 'sin mercado registrado atado al vault'
    });

    /**
     * A NAV oracle holds its vault as an immutable, and an emptied vault does not
     * report a price of zero: with no supply the ERC-4626 rate falls back to 1:1,
     * so the stale oracle would keep quoting the old price for a vault holding
     * nothing. Naming it is the difference between a follow-up and a silent lie.
     */
    const staleOracle = asset.collateralTargets.find(
      (target) => target.protocol === 'MORPHO' && target.oracleAddress
    )?.oracleAddress;
    if (staleOracle) {
      steps.push({
        step: 'oracle',
        status: 'PENDING',
        detail: `el oracle ${staleOracle} quedó atado al vault viejo y su vault es inmutable: hay que desplegar uno nuevo antes de volver a usar este activo como colateral`
      });
    } else {
      steps.push({ step: 'oracle', status: 'OK', detail: 'sin oracle atado al vault viejo' });
    }

    const signer = await resolveTreasuryOwnerSigner(provider, chainId);
    if (!signer) {
      steps.push({
        step: 'signer',
        status: 'BLOCKED',
        detail: 'no hay firmante del Safe: configurá PRIVY_SAFE_OWNER_WALLET_ID + TREASURY_OWNER_ADDRESS'
      });
      return finish('Configurá el firmante del Safe antes de migrar.');
    }

    if (input.dryRun) {
      const factoryCode = await provider.getCode(CREATE2_DEPLOYER).catch(() => '0x');
      const hasFactory = Boolean(factoryCode && factoryCode !== '0x');
      steps.push({
        step: 'deployer',
        status: hasFactory ? 'OK' : 'PENDING',
        detail: hasFactory
          ? `el Safe despliega vía el proxy CREATE2 ${CREATE2_DEPLOYER}: no hace falta ninguna clave suelta`
          : 'no hay proxy CREATE2 en esta red, así que el despliegue necesitaría TOKEN_DEPLOY_PRIVATE_KEY'
      });
      steps.push({
        step: 'plan',
        status: 'PENDING',
        detail: newVault
          ? `vault de reemplazo ya desplegado en ${newVault}; falta habilitarlo en el token y mover las shares`
          : 'falta desplegar el vault de reemplazo, habilitarlo en el token (timelock de 24 h) y mover las shares'
      });
      return finish('Repetí sin dryRun para ejecutar el próximo paso.');
    }

    // ---- Step 1: deploy the replacement vault ----------------------------
    if (!newVault) {
      const [name, symbol] = await Promise.all([
        readWithRetry(() => oldVaultContract.name() as Promise<string>),
        readWithRetry(() => oldVaultContract.symbol() as Promise<string>)
      ]);
      if (!name || !symbol) {
        steps.push({
          step: 'deploy_vault',
          status: 'BLOCKED',
          detail: 'no se pudo leer el nombre o el símbolo del vault actual'
        });
        return finish('Reintentá: el RPC no respondió.');
      }

      let deployment: { address: string; txHash: string | null; via: string };
      try {
        // Owned by the Safe from birth, which also allowlists it as a holder.
        deployment = await deployReplacementVault({
          provider,
          signer,
          treasury,
          token,
          name,
          symbol,
          projectId: asset.id
        });
      } catch (error) {
        steps.push({
          step: 'deploy_vault',
          status: 'BLOCKED',
          detail: error instanceof Error ? error.message.slice(0, 250) : 'DEPLOY_FAILED'
        });
        return finish('No se pudo desplegar el vault de reemplazo.');
      }

      newVault = deployment.address;
      await recordNewVault({
        projectId: asset.id,
        address: newVault,
        txHash: deployment.txHash
      });

      steps.push({
        step: 'deploy_vault',
        status: 'OK',
        detail: `${newVault} (${name} / ${symbol}) vía ${deployment.via}`,
        txHash: deployment.txHash ?? undefined
      });

      /**
       * The new vault bypasses its own timelock for an hour after deployment,
       * so this is the only free moment to shorten it.
       */
      const delay = await setVaultAdminDelay({
        provider,
        vaultAddress: newVault,
        delaySeconds: 3600
      }).catch(() => null);
      steps.push({
        step: 'shorten_new_vault_delay',
        status: delay?.ok ? 'OK' : 'SKIPPED',
        detail: delay?.ok
          ? `delay administrativo en 1 h (${delay.status})`
          : 'no se pudo acortar el delay dentro de la ventana de setup; no bloquea'
      });
    } else {
      steps.push({ step: 'deploy_vault', status: 'OK', detail: `reutiliza ${newVault}` });
    }

    // ---- Step 2: let the new vault hold the asset token -------------------
    const [alreadyKyc, alreadyAllowed] = await Promise.all([
      readWithRetry(() => tokenContract.kycApproved(newVault!) as Promise<boolean>),
      readWithRetry(() => tokenContract.externalContractAllowed(newVault!) as Promise<boolean>)
    ]);

    let permissionsPending = false;

    if (alreadyKyc === true) {
      steps.push({ step: 'token_kyc', status: 'OK', detail: 'el vault nuevo ya está aprobado en el token' });
    } else {
      /**
       * Ask the timelock before trying.
       *
       * This runs on every call by design, and `setKyc` inside a running
       * timelock does not fail politely — it broadcasts and reverts, spending
       * gas to learn what the contract would have told us for free.
       */
      const timelock = await readKycTimelock({
        provider,
        tokenAddress: token,
        investorAddress: newVault
      }).catch(() => null);

      if (timelock && !timelock.ready && timelock.readyAt) {
        permissionsPending = true;
        steps.push({
          step: 'token_kyc',
          status: 'PENDING',
          detail: `timelock corriendo, ejecutable a partir de ${new Date(timelock.readyAt * 1000).toISOString()}`
        });
      } else {
        try {
          const result = await setInvestorKycAllowlist({
            tokenAddress: token,
            walletAddress: newVault,
            approved: true
          });
          steps.push({ step: 'token_kyc', status: 'OK', detail: 'aprobado', txHash: result.txHash });
        } catch (error) {
          const scheduled = await scheduleTokenKyc({
            provider,
            tokenAddress: token,
            investorAddress: newVault
          }).catch(() => null);
          permissionsPending = true;
          steps.push({
            step: 'token_kyc',
            status: 'PENDING',
            detail:
              scheduled?.ok === true
                ? `timelock agendado, ejecutable a partir de ${
                    scheduled.readyAt
                      ? new Date(scheduled.readyAt * 1000).toISOString()
                      : 'dentro de 24 h'
                  }`
                : `${scheduled?.ok === false ? scheduled.code : 'SCHEDULE_FAILED'}: ${
                    error instanceof Error ? error.message.slice(0, 160) : ''
                  }`
          });
        }
      }
    }

    if (alreadyAllowed === true) {
      steps.push({
        step: 'token_holder_allowance',
        status: 'OK',
        detail: 'el token ya acepta al vault nuevo como tenedor'
      });
    } else {
      // The token exposes the same allowance interface as the vault.
      const outcome = await ensureVaultRecipientAllowed({
        provider,
        vaultAddress: token,
        recipient: newVault
      });
      if (outcome.ok === false) {
        permissionsPending = true;
        steps.push({
          step: 'token_holder_allowance',
          status: 'PENDING',
          detail: `${outcome.code}${outcome.detail ? `: ${outcome.detail}` : ''}`
        });
      } else if (outcome.status === 'ALLOWED' || outcome.status === 'ALREADY_ALLOWED') {
        steps.push({
          step: 'token_holder_allowance',
          status: 'OK',
          detail: outcome.status,
          txHash: 'txHash' in outcome ? outcome.txHash : undefined
        });
      } else {
        permissionsPending = true;
        steps.push({
          step: 'token_holder_allowance',
          status: 'PENDING',
          detail: `timelock agendado (${outcome.status})`,
          txHash: 'txHash' in outcome ? outcome.txHash : undefined
        });
      }
    }

    if (permissionsPending) {
      return finish(
        'Los permisos del token quedaron agendados. Volvé a llamar esto cuando venza el timelock (24 h) y sigue solo.'
      );
    }

    // ---- Step 3: move the shares ----------------------------------------
    /**
     * Once the project points at the replacement, there is nothing to redeem.
     *
     * Running this again used to treat the current vault as the old one and
     * redeem the shares straight out of it, leaving the project pointing at an
     * empty vault with the tokens loose in the Safe. The call has to be safe to
     * repeat: that is the whole premise of a migration that runs in stages.
     */
    const alreadyMigrated = oldVault.toLowerCase() === newVault.toLowerCase();

    let shares = 0n;
    let redeemed = 0n;
    /** Block anchor for the verification read: the last write this run made. */
    let lastWriteTx: string | null = null;
    if (alreadyMigrated) {
      steps.push({
        step: 'redeem_old_vault',
        status: 'SKIPPED',
        detail: 'el proyecto ya apunta al vault nuevo: no hay vault viejo del que rescatar'
      });
    } else {
      const held = await readWithRetry(() => oldVaultContract.balanceOf(treasury) as Promise<bigint>);
      if (held === null) {
        steps.push({ step: 'move_shares', status: 'BLOCKED', detail: 'no se pudo leer el balance' });
        return finish('Reintentá: el RPC no respondió.');
      }
      shares = held;
    }

    /**
     * Each leg stands on its own, keyed off what the chain currently says.
     * A run that redeems and then fails to deposit leaves the treasury holding
     * bare asset tokens, and the next call has to pick that up rather than
     * decide there is nothing left to move.
     */
    if (shares > 0n) {
      const assets = await readWithRetry(
        () => oldVaultContract.previewRedeem(shares) as Promise<bigint>
      );
      if (assets === null || assets <= 0n) {
        steps.push({
          step: 'redeem_old_vault',
          status: 'BLOCKED',
          detail: 'previewRedeem no devolvió activos'
        });
        return finish('Reintentá: el RPC no respondió.');
      }

      const redeemTx = await execAsOwner({
        owner: treasury,
        signer,
        target: oldVault,
        data: oldVaultContract.interface.encodeFunctionData('redeem', [shares, treasury, treasury])
      });
      steps.push({
        step: 'redeem_old_vault',
        status: 'OK',
        detail: `${formatUnits(shares, oldDecimals)} shares rescatadas por ${formatUnits(assets, 18)} tokens`,
        txHash: redeemTx
      });
      redeemed = assets;
      lastWriteTx = redeemTx;
    } else if (!alreadyMigrated) {
      steps.push({ step: 'redeem_old_vault', status: 'SKIPPED', detail: 'el vault viejo ya está vacío' });
    }

    /**
     * After a redeem the balance has to be read as at least what came out.
     *
     * A single read here can land on a node that has not applied the redeem and
     * answer with the balance from before — zero. That is a successful read of a
     * stale value, so no retry helper catches it, and the deposit gets skipped
     * for "no loose tokens" while 5000 of them sit in the Safe.
     */
    const heldAssets =
      redeemed > 0n
        ? (
            await confirmOnChain({
              read: () => tokenContract.balanceOf(treasury) as Promise<bigint>,
              satisfied: (balance) => balance >= redeemed
            })
          ).value
        : await readWithRetry(() => tokenContract.balanceOf(treasury) as Promise<bigint>);

    if (heldAssets === null) {
      steps.push({ step: 'deposit_new_vault', status: 'BLOCKED', detail: 'no se pudo leer el balance de tokens' });
      return finish('Reintentá: el RPC no respondió.');
    }
    if (redeemed > 0n && heldAssets < redeemed) {
      steps.push({
        step: 'deposit_new_vault',
        status: 'BLOCKED',
        detail: `el redeem sacó ${formatUnits(redeemed, 18)} tokens pero la tesorería lee ${formatUnits(
          heldAssets,
          18
        )}: las lecturas no se pusieron al día`
      });
      return finish('Los tokens están en la tesorería pero el RPC va atrasado. Reintentá en un minuto.');
    }

    if (heldAssets > 0n) {
      const allowance = await readWithRetry(
        () => tokenContract.allowance(treasury, newVault!) as Promise<bigint>
      );
      if (allowance === null || allowance < heldAssets) {
        const approveTx = await execAsOwner({
          owner: treasury,
          signer,
          target: token,
          data: tokenContract.interface.encodeFunctionData('approve', [newVault, heldAssets])
        });
        steps.push({
          step: 'approve_new_vault',
          status: 'OK',
          detail: `allowance de ${formatUnits(heldAssets, 18)} tokens`,
          txHash: approveTx
        });
      } else {
        steps.push({ step: 'approve_new_vault', status: 'SKIPPED', detail: 'allowance suficiente' });
      }

      const newVaultContract = new Contract(newVault, VAULT_ABI, provider);
      const depositTx = await execAsOwner({
        owner: treasury,
        signer,
        target: newVault,
        data: newVaultContract.interface.encodeFunctionData('deposit', [heldAssets, treasury])
      });
      steps.push({
        step: 'deposit_new_vault',
        status: 'OK',
        detail: `${formatUnits(heldAssets, 18)} tokens depositados`,
        txHash: depositTx
      });
      lastWriteTx = depositTx;
    } else {
      steps.push({
        step: 'deposit_new_vault',
        status: 'SKIPPED',
        detail: 'la tesorería no tiene tokens sueltos para depositar'
      });
    }

    /**
     * Verify in the new vault's own units: it carries the inflation-attack
     * offset the old one predates, so the raw numbers will not match even when
     * the migration is exactly right.
     */
    const newDecimals = await readVaultShareDecimals({ provider, vaultAddress: newVault });
    const expected =
      newDecimals === null ? null : vaultSharesForTokens(asset.totalTokens, newDecimals);

    if (expected === null) {
      steps.push({ step: 'verify', status: 'BLOCKED', detail: 'no se pudo leer decimals() del vault nuevo' });
      return finish('Verificá a mano el balance del vault nuevo antes de reapuntar el proyecto.');
    }

    /**
     * Read as of the block that carried the last write, not "latest".
     *
     * `latest` on a load-balanced RPC can be a node several blocks behind, and a
     * balance from before the migration satisfies this check just as well as the
     * real one — which is how a run that emptied the vault reported the full
     * quota sitting in it. Naming the block turns a stale answer into an error
     * the confirmation loop retries, instead of a false green.
     */
    const anchor = lastWriteTx
      ? await provider
          .getTransactionReceipt(lastWriteTx)
          .then((receipt) => receipt?.blockNumber ?? null)
          .catch(() => null)
      : null;

    const newVaultReader = new Contract(newVault, VAULT_ABI, provider);
    const verification = await confirmOnChain({
      read: () =>
        newVaultReader.balanceOf(treasury, anchor ? { blockTag: anchor } : {}) as Promise<bigint>,
      satisfied: (balance) => balance >= expected
    });
    const newShares = verification.value;

    if (!verification.confirmed) {
      steps.push({
        step: 'verify',
        status: 'BLOCKED',
        detail: `la tesorería tiene ${
          newShares === null ? 'un balance ilegible' : formatUnits(newShares, newDecimals!)
        } y debería tener ${asset.totalTokens}`
      });
      return finish(
        'No reapunté el proyecto: el vault nuevo no quedó con el cupo completo. Volvé a llamar esto: si el depósito ya pasó, la próxima lectura lo va a ver.'
      );
    }
    steps.push({
      step: 'verify',
      status: 'OK',
      detail: `${formatUnits(newShares, newDecimals!)} shares en la tesorería (${newDecimals} decimales)`
    });

    // ---- Step 4: rewire the platform ------------------------------------
    const moduleAddress = deliveryOperatorModuleAddress();
    if (moduleAddress) {
      const wiring = await setupDeliveryOperatorModule({
        safeAddress: treasury,
        vaults: [{ vaultAddress: newVault, kycTokenAddress: token }],
        operatorAddress: (await signer.getAddress()) as string,
        moduleAddress,
        signer
      }).catch((error) => ({
        steps: [
          {
            step: 'allow_vault' as const,
            ok: false,
            error: error instanceof Error ? error.message.slice(0, 160) : 'WIRING_FAILED'
          }
        ]
      }));
      const allowStep = wiring.steps.find((row) => row.step === 'allow_vault');
      steps.push({
        step: 'delivery_module',
        status: allowStep?.ok ? 'OK' : 'PENDING',
        detail: allowStep?.ok
          ? 'el vault nuevo quedó habilitado en el módulo de entrega'
          : allowStep?.error ?? 'no se pudo habilitar',
        txHash: allowStep && 'txHash' in allowStep ? allowStep.txHash : undefined
      });
    } else {
      steps.push({
        step: 'delivery_module',
        status: 'SKIPPED',
        detail: 'no hay módulo de entrega configurado'
      });
    }

    /**
     * Drop the oracle and market bound to the old vault along with the pointer.
     * Leaving them would let the platform quote a price for a vault the project
     * no longer uses, and an emptied vault still answers with the old rate.
     */
    const collateralTargets = asset.collateralTargets.map((target) =>
      target.protocol === 'MORPHO' && (target.oracleAddress || target.externalId)
        ? {
            ...target,
            status: 'READY' as const,
            oracleAddress: null,
            externalId: null,
            notes: `Vault migrado a ${newVault}: hay que volver a desplegar oracle y mercado.`
          }
        : target
    );

    await updateAdminAsset(asset.id, { vaultAddress: newVault, collateralTargets });
    await appendDeploymentEvent(asset.id, {
      step: 'VAULT_DEPLOY',
      status: 'SUCCESS',
      message: `Proyecto reapuntado del vault ${oldVault} al ${newVault}.`,
      address: newVault
    });
    steps.push({ step: 'repoint_project', status: 'OK', detail: `vaultAddress = ${newVault}` });

    return finish(
      'Migración completa. Corré el preflight y una compra de prueba; el vault viejo queda vacío y sin uso.',
      true
    );
  } catch (error) {
    /**
     * A migration that crashes mid-way has usually already done something on
     * chain — deployed the vault, scheduled a timelock, moved the shares. If the
     * throw escapes, the caller gets a 500 with none of that, and the only way
     * to find out what happened is to read the chain by hand. Keep the steps and
     * name the crash as one more of them.
     */
    steps.push({
      step: 'error',
      status: 'BLOCKED',
      detail: error instanceof Error ? error.message.slice(0, 300) : 'MIGRATION_CRASHED'
    });
    console.error('[vaultMigration] unexpected failure', error);
    return finish('La migración cortó por un error inesperado. Los pasos de arriba sí se hicieron.');
  } finally {
    provider.destroy();
  }
}
