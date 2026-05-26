import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function shell(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

const sha = shell('git rev-parse --short HEAD');
const date = new Date().toISOString();
const outputDir = join(process.cwd(), 'docs', 'audit');
const outputPath = join(outputDir, `rwa-security-audit-${sha}.md`);

const report = `# RWA Security Audit Report

Generated: ${date}
Commit: ${sha}

## Scope
- \`packages/contracts/contracts/SanovaAssetToken.sol\`
- \`packages/contracts/contracts/SanovaRwaVault.sol\`
- \`packages/contracts/contracts/SanovaFixedPriceOracle.sol\`
- RWA deployment and borrow guards in \`apps/web/src/lib/blockchain\` and \`apps/web/src/lib/lending\`.

## Required Automated Evidence
- [ ] \`npm run contracts:security-audit\` passes.
- [ ] CI Slither job passes with \`REQUIRE_SLITHER=true\`.
- [ ] \`npm run contracts:test\` passes.
- [ ] \`npm run typecheck\` passes.
- [ ] Web production build/deploy passes.

## Manual Review Checklist
- [ ] Token and vault pause paths are owner-only and cannot be bypassed.
- [ ] Admin timelock protects dangerous post-setup actions.
- [ ] Initial setup window is short and only used before ownership transfer.
- [ ] Ownership transfers to treasury/Safe are verified with \`owner()\`.
- [ ] External contract allowlist contains only official protocol/token/oracle addresses.
- [ ] Daily withdrawal limit is conservative relative to total assets.
- [ ] Borrow amount is capped by both daily USD limit and LTV safety margin.
- [ ] Oracle price validation blocks stale or mismatched price configuration.
- [ ] Circuit breaker activates on failed security report or balance anomalies.
- [ ] No private key or treasury secret is committed or logged.

## External Auditor Sign-Off
- Auditor:
- Organization:
- Date:
- Findings:
- Remediation commit(s):
- Approval for mainnet capital: yes/no

## Notes
This report is a required checklist artifact before deploying assets with material capital on mainnet.
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, report, 'utf8');
console.log(outputPath);
