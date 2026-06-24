import fs from 'node:fs';
import path from 'node:path';

const COMPILER_VERSION = 'v0.8.20+commit.a1b79de6';

const CONTRACT_FILES: Record<string, string> = {
  SanovaAssetToken: 'SanovaAssetToken.sol',
  SanovaRwaVault: 'SanovaRwaVault.sol',
  SanovaFixedPriceOracle: 'SanovaFixedPriceOracle.sol',
  SanovaNavOracle: 'SanovaNavOracle.sol'
};

function resolveRepoRoot(): string {
  const candidates = [
    process.cwd(),
    path.join(process.cwd(), '..', '..'),
    path.join(process.cwd(), '..')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'packages', 'contracts', 'contracts'))) {
      return candidate;
    }
  }
  return process.cwd();
}

function readSourceFile(absolutePath: string): string | null {
  try {
    return fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return null;
  }
}

function collectImportPaths(source: string, repoRoot: string): string[] {
  const paths: string[] = [];
  const importRegex = /import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+"([^"]+)";/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('@')) {
      const ozPath = path.join(repoRoot, 'node_modules', ...importPath.split('/'));
      paths.push(ozPath);
    }
  }
  return paths;
}

function buildSourcesMap(contractName: string): Record<string, { content: string }> | null {
  const fileName = CONTRACT_FILES[contractName];
  if (!fileName) return null;

  const repoRoot = resolveRepoRoot();
  const contractPath = path.join(repoRoot, 'packages', 'contracts', 'contracts', fileName);
  const primary = readSourceFile(contractPath);
  if (!primary) return null;

  const sources: Record<string, { content: string }> = {
    [`contracts/${fileName}`]: { content: primary }
  };

  const queue = [...collectImportPaths(primary, repoRoot)];
  const seen = new Set<string>();

  while (queue.length) {
    const absolute = queue.shift()!;
    if (seen.has(absolute)) continue;
    seen.add(absolute);

    const content = readSourceFile(absolute);
    if (!content) continue;

    const key = absolute.includes('node_modules')
      ? absolute.split('node_modules')[1]!.replace(/\\/g, '/').replace(/^\//, '')
      : absolute;

    sources[key] = { content };
    for (const nested of collectImportPaths(content, repoRoot)) {
      if (!seen.has(nested)) queue.push(nested);
    }
  }

  return sources;
}

export function buildVerificationStandardJson(contractName: string): {
  sourceCode: string;
  contractName: string;
  compilerversion: string;
} | null {
  const sources = buildSourcesMap(contractName);
  if (!sources) return null;

  const fileName = CONTRACT_FILES[contractName];
  return {
    sourceCode: JSON.stringify({
      language: 'Solidity',
      sources,
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode']
          }
        }
      }
    }),
    contractName: `contracts/${fileName}:${contractName}`,
    compilerversion: COMPILER_VERSION
  };
}

export async function pollExplorerVerificationStatus(
  chainId: number,
  guid: string
): Promise<'pending' | 'verified' | 'failed'> {
  const apiKey =
    chainId === 8453 || chainId === 84532
      ? process.env.BASESCAN_API_KEY?.trim()
      : chainId === 137 || chainId === 80002
        ? process.env.POLYGONSCAN_API_KEY?.trim()
        : process.env.ETHERSCAN_API_KEY?.trim();

  if (!apiKey || !guid) return 'pending';

  const baseUrl =
    chainId === 84532
      ? 'https://api-sepolia.basescan.org/api'
      : chainId === 8453
        ? 'https://api.basescan.org/api'
        : chainId === 80002
          ? 'https://api-amoy.polygonscan.com/api'
          : chainId === 137
            ? 'https://api.polygonscan.com/api'
            : 'https://api.etherscan.io/api';

  const url = `${baseUrl}?module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}&apikey=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = (await response.json()) as { result?: string };
    const result = (data.result ?? '').toLowerCase();
    if (result.includes('pass') || result.includes('verified')) return 'verified';
    if (result.includes('fail')) return 'failed';
    return 'pending';
  } catch {
    return 'pending';
  }
}
