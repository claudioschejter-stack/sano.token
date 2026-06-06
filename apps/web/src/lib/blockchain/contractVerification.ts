import { appendDeploymentEvent } from '../admin/assetsService';
import { notifyExplorerVerification } from '../admin/automationAlerts';
import {
  buildVerificationStandardJson,
  pollExplorerVerificationStatus
} from './contractVerificationSources';

function explorerApiKey(chainId: number): string | null {
  if (chainId === 8453 || chainId === 84532) {
    return process.env.BASESCAN_API_KEY?.trim() || null;
  }
  if (chainId === 137 || chainId === 80002) {
    return process.env.POLYGONSCAN_API_KEY?.trim() || null;
  }
  return process.env.ETHERSCAN_API_KEY?.trim() || null;
}

function explorerApiUrl(chainId: number): string {
  if (chainId === 84532) return 'https://api-sepolia.basescan.org/api';
  if (chainId === 8453) return 'https://api.basescan.org/api';
  if (chainId === 80002) return 'https://api-amoy.polygonscan.com/api';
  if (chainId === 137) return 'https://api.polygonscan.com/api';
  return 'https://api.etherscan.io/api';
}

export async function recordExplorerVerification(
  projectId: string,
  input: {
    contractAddress: string;
    contractName: string;
    chainId: number;
  }
) {
  const apiKey = explorerApiKey(input.chainId);
  const standardJson = buildVerificationStandardJson(input.contractName);

  if (apiKey && standardJson) {
    const form = new URLSearchParams({
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: input.contractAddress,
      sourceCode: standardJson.sourceCode,
      codeformat: 'solidity-standard-json-input',
      contractname: standardJson.contractName,
      compilerversion: standardJson.compilerversion,
      optimizationUsed: '1',
      runs: '200'
    });

    try {
      const response = await fetch(explorerApiUrl(input.chainId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      const data = (await response.json().catch(() => null)) as {
        status?: string;
        message?: string;
        result?: string;
      } | null;
      const guid = data?.result?.trim();
      const submitted = response.ok && Boolean(guid) && !guid.toLowerCase().includes('error');

      if (submitted && guid) {
        let verifyStatus: 'pending' | 'verified' | 'failed' = 'pending';
        for (let attempt = 0; attempt < 6; attempt += 1) {
          verifyStatus = await pollExplorerVerificationStatus(input.chainId, guid);
          if (verifyStatus !== 'pending') break;
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        await appendDeploymentEvent(projectId, {
          step: 'EXPLORER_VERIFY',
          status: verifyStatus === 'verified' ? 'SUCCESS' : verifyStatus === 'failed' ? 'FAILED' : 'PENDING',
          message:
            verifyStatus === 'verified'
              ? `${input.contractName} verificado en explorer (GUID ${guid}).`
              : verifyStatus === 'failed'
                ? `Verificación explorer falló para ${input.contractName} (GUID ${guid}).`
                : `Verificación enviada para ${input.contractName}. GUID: ${guid}`,
          address: input.contractAddress,
          externalId: guid
        });
        await notifyExplorerVerification(
          projectId,
          input.contractName,
          verifyStatus === 'verified' ? 'VERIFIED' : verifyStatus === 'failed' ? 'FAILED' : 'PENDING'
        );
        return;
      }

      await appendDeploymentEvent(projectId, {
        step: 'EXPLORER_VERIFY',
        status: 'FAILED',
        message: `Verificación explorer falló para ${input.contractName}: ${data?.result ?? data?.message ?? response.status}`,
        address: input.contractAddress
      });
      await notifyExplorerVerification(projectId, input.contractName, 'FAILED');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Explorer verification failed';
      await appendDeploymentEvent(projectId, {
        step: 'EXPLORER_VERIFY',
        status: 'FAILED',
        message,
        address: input.contractAddress
      });
      await notifyExplorerVerification(projectId, input.contractName, 'FAILED');
      return;
    }
  }

  await appendDeploymentEvent(projectId, {
    step: 'EXPLORER_VERIFY',
    status: apiKey ? 'PENDING' : 'SKIPPED',
    message: apiKey
      ? `No se pudieron cargar fuentes Solidity para ${input.contractName}.`
      : `Falta API key explorer para verificar ${input.contractName}.`,
    address: input.contractAddress
  });
}
