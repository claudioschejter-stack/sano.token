import { appendDeploymentEvent } from '../admin/assetsService';

function explorerApiKey(chainId: number): string | null {
  if (chainId === 8453 || chainId === 84532) {
    return process.env.BASESCAN_API_KEY?.trim() || null;
  }
  if (chainId === 137 || chainId === 80002) {
    return process.env.POLYGONSCAN_API_KEY?.trim() || null;
  }
  return process.env.ETHERSCAN_API_KEY?.trim() || null;
}

export async function recordExplorerVerification(projectId: string, input: {
  contractAddress: string;
  contractName: string;
  chainId: number;
}) {
  const apiKey = explorerApiKey(input.chainId);

  await appendDeploymentEvent(projectId, {
    step: 'EXPLORER_VERIFY',
    status: apiKey ? 'PENDING' : 'SKIPPED',
    message: apiKey
      ? `Verificación preparada para ${input.contractName}. Ejecutar verificación explorer con artifacts compilados.`
      : `Falta API key explorer para verificar ${input.contractName}.`,
    address: input.contractAddress
  });
}
