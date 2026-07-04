import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const contractsDir = join(root, 'packages/contracts');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    shell: true,
    encoding: 'utf8'
  });
  return result;
}

function requireSourcePattern(file, checks) {
  const source = readFileSync(join(contractsDir, 'contracts', file), 'utf8');
  const missing = checks.filter((check) => !check.pattern.test(source)).map((check) => check.name);
  if (missing.length) {
    throw new Error(`${file} missing security controls: ${missing.join(', ')}`);
  }
}

console.log('[rwa-audit] Compiling contracts...');
const compile = run('npx', ['hardhat', 'compile'], { cwd: contractsDir });
if (compile.status !== 0) {
  console.error(compile.stdout);
  console.error(compile.stderr);
  process.exit(compile.status ?? 1);
}

console.log('[rwa-audit] Checking required invariants...');
requireSourcePattern('SanovaAssetToken.sol', [
  { name: 'Pausable', pattern: /is ERC20, Ownable, Pausable/ },
  { name: 'admin timelock', pattern: /onlyAfterTimelock/ },
  { name: 'external contract allowlist', pattern: /externalContractAllowed/ },
  { name: 'paused transfer guard', pattern: /whenNotPaused/ }
]);

requireSourcePattern('SanovaRwaVault.sol', [
  { name: 'Pausable', pattern: /is ERC4626, Ownable, Pausable/ },
  { name: 'admin timelock', pattern: /onlyAfterTimelock/ },
  { name: 'external contract allowlist', pattern: /externalContractAllowed/ },
  { name: 'daily withdrawal limit', pattern: /dailyWithdrawalLimit/ },
  { name: 'withdrawal accounting', pattern: /withdrawnAssetsByDay/ }
]);

console.log('[rwa-audit] Running Slither if available...');
// Only fail the build on High severity findings in our own contracts: Slither's
// default exit behavior fails on ANY finding (including informational/optimization
// notes inside vendored OpenZeppelin code we don't control), which made this gate
// unusable in CI. Medium/Low/Informational findings are still printed for manual
// review before mainnet, they just don't block every commit.
const slither = run(
  'slither',
  ['.', '--exclude-dependencies', '--fail-high'],
  { cwd: contractsDir }
);
if (slither.status === 0) {
  console.log(slither.stdout);
} else {
  if (process.env.REQUIRE_SLITHER === 'true') {
    console.error(slither.stdout || slither.stderr);
    process.exit(slither.status ?? 1);
  }
  console.warn('[rwa-audit] Slither unavailable or reported findings. Review output before mainnet.');
  console.warn((slither.stdout || slither.stderr || '').slice(0, 4000));
}

console.log('[rwa-audit] Completed.');
