import { appendDeploymentEvent } from '../admin/assetsService';
import { notifyExplorerVerification } from '../admin/automationAlerts';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import SanovaFixedPriceOracleArtifact from './artifacts/SanovaFixedPriceOracle.json';

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

function artifactFor(contractName: string): { sourceName: string; source: string; abi: unknown } | null {
  if (contractName === 'SanovaAssetToken') {
    return {
      sourceName: 'contracts/SanovaAssetToken.sol',
      source: '// Source verification is prepared from compiled artifact. Upload full source via Hardhat when exact metadata is required.',
      abi: SanovaAssetTokenArtifact.abi
    };
  }
  if (contractName === 'SanovaRwaVault') {
    return {
      sourceName: 'contracts/SanovaRwaVault.sol',
      source: '// Source verification is prepared from compiled artifact. Upload full source via Hardhat when exact metadata is required.',
      abi: SanovaRwaVaultArtifact.abi
    };
  }
  if (contractName === 'SanovaFixedPriceOracle') {
    return {
      sourceName: 'contracts/SanovaFixedPriceOracle.sol',
      source: '// Source verification is prepared from compiled artifact. Upload full source via Hardhat when exact metadata is required.',
      abi: SanovaFixedPriceOracleArtifact.abi
    };
  }
  return null;
}

export async function recordExplorerVerification(projectId: string, input: {
  contractAddress: string;
  contractName: string;
  chainId: number;
}) {
  const apiKey = explorerApiKey(input.chainId);
  const artifact = artifactFor(input.contractName);

  if (apiKey && artifact) {
    const form = new URLSearchParams({
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: input.contractAddress,
      sourceCode: JSON.stringify({
        language: 'Solidity',
        sources: {
          [artifact.sourceName]: { content: artifact.source }
        },
        settings: {}
      }),
      codeformat: 'solidity-standard-json-input',
      contractname: `${artifact.sourceName}:${input.contractName}`,
      compilerversion: 'v0.8.20+commit.a1b79de6',
      optimizationUsed: '1',
      runs: '200'
    });

    try {
      const response = await fetch(explorerApiUrl(input.chainId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      const data = (await response.json().catch(() => null)) as { status?: string; message?: string; result?: string } | null;
      const ok = response.ok && (data?.status === '1' || data?.message?.toLowerCase().includes('ok'));

      await appendDeploymentEvent(projectId, {
        step: 'EXPLORER_VERIFY',
        status: ok ? 'SUCCESS' : 'FAILED',
        message: ok
          ? `Verificación enviada para ${input.contractName}. GUID: ${data?.result ?? 'submitted'}`
          : `Verificación explorer falló para ${input.contractName}: ${data?.result ?? data?.message ?? response.status}`,
        address: input.contractAddress
      });
      await notifyExplorerVerification(projectId, input.contractName, ok ? 'VERIFIED' : 'FAILED');
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
      ? `Verificación preparada para ${input.contractName}. Ejecutar verificación explorer con artifacts compilados.`
      : `Falta API key explorer para verificar ${input.contractName}.`,
    address: input.contractAddress
  });
}
