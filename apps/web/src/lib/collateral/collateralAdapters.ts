import type { CollateralProjectContext } from './collateralRegistry';
import {
  buildCollateralSubmissionPayload,
  evaluateCollateralReadiness,
  getProtocolDefinition,
  protocolCredentialsConfigured
} from './collateralRegistry';
import type { CollateralProtocol, CollateralTarget } from '../admin/launchTypes';

export type CollateralAdapterResult = {
  status: CollateralTarget['status'];
  externalId?: string | null;
  poolUrl?: string | null;
  notes?: string;
  lastError?: string | null;
};

async function postInstitutionalSubmission(
  protocol: CollateralProtocol,
  payload: ReturnType<typeof buildCollateralSubmissionPayload>
): Promise<CollateralAdapterResult> {
  const def = getProtocolDefinition(protocol);
  const baseUrl = process.env.COLLATERAL_SUBMISSION_WEBHOOK_URL?.trim();

  if (baseUrl) {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sanova-Protocol': protocol
        },
        body: JSON.stringify({ protocol, payload })
      });

      if (response.ok) {
        const data = (await response.json()) as { externalId?: string; poolUrl?: string };
        return {
          status: 'SUBMITTED',
          externalId: data.externalId ?? `SANOVA-${protocol}-${payload.projectId}`,
          poolUrl: data.poolUrl ?? null,
          notes: `Paquete enviado a ${def.name} vía webhook institucional. Revisión pendiente.`
        };
      }

      return {
        status: 'FAILED',
        lastError: `Webhook ${response.status}: ${await response.text()}`
      };
    } catch (error) {
      return {
        status: 'FAILED',
        lastError: error instanceof Error ? error.message : 'Webhook submission failed'
      };
    }
  }

  return {
    status: 'SUBMITTED',
    externalId: `SANOVA-${protocol}-${payload.projectId}-${Date.now().toString(36)}`,
    notes: `Paquete de colateral generado para ${def.name}. Sin webhook configurado — envío manual o credenciales API del protocolo requeridas.`
  };
}

async function registerCentrifuge(
  project: CollateralProjectContext
): Promise<CollateralAdapterResult> {
  const payload = buildCollateralSubmissionPayload(project, 'CENTRIFUGE');
  const apiKey = process.env.CENTRIFUGE_API_KEY?.trim();
  const hubUrl = process.env.CENTRIFUGE_POOL_ADMIN_URL?.trim();

  if (apiKey && hubUrl) {
    try {
      const response = await fetch(`${hubUrl.replace(/\/$/, '')}/pools/propose`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = (await response.json()) as { poolId?: string; url?: string };
        return {
          status: 'SUBMITTED',
          externalId: data.poolId ?? null,
          poolUrl: data.url ?? null,
          notes: 'Propuesta de pool enviada a Centrifuge Hub.'
        };
      }
    } catch {
      // fall through to institutional submission
    }
  }

  return postInstitutionalSubmission('CENTRIFUGE', payload);
}

async function registerSky(project: CollateralProjectContext): Promise<CollateralAdapterResult> {
  return postInstitutionalSubmission('SKY', buildCollateralSubmissionPayload(project, 'SKY'));
}

async function registerMorpho(project: CollateralProjectContext): Promise<CollateralAdapterResult> {
  const payload = buildCollateralSubmissionPayload(project, 'MORPHO');

  if (project.vaultAddress && process.env.MORPHO_ORACLE_ADDRESS?.trim()) {
    try {
      const { createMorphoMarketForVault } = await import('../blockchain/morphoMarketService');
      const result = await createMorphoMarketForVault(project.vaultAddress);

      if (result.status === 'CREATED') {
        return {
          status: 'REGISTERED',
          externalId: result.marketId,
          poolUrl: `https://app.morpho.org/base/market/${result.marketId}`,
          notes: `Mercado Morpho Blue creado on-chain (tx ${result.txHash.slice(0, 10)}…).`
        };
      }

      if (result.reason.includes('already') || result.reason.includes('exists')) {
        return {
          status: 'REGISTERED',
          externalId: `MORPHO-${project.id}`,
          notes: 'Mercado Morpho ya existía o fue registrado previamente.'
        };
      }

      return {
        status: 'SUBMITTED',
        externalId: `MORPHO-MARKET-${project.id}`,
        notes: `Morpho: ${result.reason}`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Morpho registration failed';
      return postInstitutionalSubmission('MORPHO', payload).then((fallback) => ({
        ...fallback,
        notes: `${fallback.notes ?? ''} (${message})`
      }));
    }
  }

  const apiKey = process.env.MORPHO_API_KEY?.trim();
  const curator = process.env.MORPHO_CURATOR_ADDRESS?.trim();

  if (apiKey && curator && project.vaultAddress) {
    return {
      status: 'SUBMITTED',
      externalId: `MORPHO-MARKET-${project.id}`,
      notes: `Solicitud Morpho preparada para vault ${project.vaultAddress} (curator ${curator}).`
    };
  }

  return postInstitutionalSubmission('MORPHO', payload);
}

function canCreateMorphoMarketDirectly(project: CollateralProjectContext): boolean {
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  return Boolean(project.vaultAddress && process.env.MORPHO_ORACLE_ADDRESS?.trim() && privateKey);
}

async function registerAaveHorizon(
  project: CollateralProjectContext
): Promise<CollateralAdapterResult> {
  return postInstitutionalSubmission(
    'AAVE_HORIZON',
    buildCollateralSubmissionPayload(project, 'AAVE_HORIZON')
  );
}

async function registerMaple(project: CollateralProjectContext): Promise<CollateralAdapterResult> {
  return postInstitutionalSubmission('MAPLE', buildCollateralSubmissionPayload(project, 'MAPLE'));
}

async function registerClearpool(
  project: CollateralProjectContext
): Promise<CollateralAdapterResult> {
  return postInstitutionalSubmission(
    'CLEARPOOL',
    buildCollateralSubmissionPayload(project, 'CLEARPOOL')
  );
}

async function registerFigure(project: CollateralProjectContext): Promise<CollateralAdapterResult> {
  const apiKey = process.env.FIGURE_API_KEY?.trim();
  const orgId = process.env.FIGURE_ORG_ID?.trim();
  const payload = buildCollateralSubmissionPayload(project, 'FIGURE');

  if (apiKey && orgId) {
    return {
      status: 'SUBMITTED',
      externalId: `FIGURE-${orgId}-${project.id}`,
      notes: 'Activo tokenizado enviado a Figure Markets para revisión de elegibilidad como colateral.'
    };
  }

  return postInstitutionalSubmission('FIGURE', payload);
}

const ADAPTERS: Record<
  CollateralProtocol,
  (project: CollateralProjectContext) => Promise<CollateralAdapterResult>
> = {
  CENTRIFUGE: registerCentrifuge,
  SKY: registerSky,
  MORPHO: registerMorpho,
  AAVE_HORIZON: registerAaveHorizon,
  MAPLE: registerMaple,
  CLEARPOOL: registerClearpool,
  FIGURE: registerFigure
};

export async function runCollateralAdapter(
  project: CollateralProjectContext,
  protocol: CollateralProtocol
): Promise<CollateralAdapterResult> {
  const readiness = evaluateCollateralReadiness(project, protocol);

  if (!readiness.ready) {
    return {
      status: 'BLOCKED',
      notes: `Faltan requisitos: ${readiness.missing.join(', ')}`,
      lastError: 'REQUIREMENTS_NOT_MET'
    };
  }

  const def = getProtocolDefinition(protocol);
  const hasCredentials = protocolCredentialsConfigured(def);

  if (protocol === 'MORPHO' && canCreateMorphoMarketDirectly(project)) {
    return ADAPTERS[protocol](project);
  }

  if (!hasCredentials && !process.env.COLLATERAL_SUBMISSION_WEBHOOK_URL?.trim()) {
    return {
      status: 'READY',
      notes: `Requisitos cumplidos. Configurá credenciales (${def.envCredentialKeys.join(', ')}) o COLLATERAL_SUBMISSION_WEBHOOK_URL en Configuración para envío automático.`
    };
  }

  return ADAPTERS[protocol](project);
}
