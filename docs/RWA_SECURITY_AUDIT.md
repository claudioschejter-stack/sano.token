# RWA Security Audit Runbook

This runbook is the required manual audit packet before using the RWA token/vault/borrow module with material mainnet capital.

## Automated Gates

Run these before requesting external review:

```bash
npm run contracts:security-audit
npm run contracts:test
npm run typecheck
npm run contracts:audit-report
```

CI also runs Slither with `REQUIRE_SLITHER=true`, so missing Slither or high-confidence findings block the pipeline.

## Manual Review Scope

- `SanovaAssetToken.sol`
- `SanovaRwaVault.sol`
- `SanovaFixedPriceOracle.sol`
- RWA deployment, ownership transfer, allowlist, daily limits, security report, and borrow guards.

## Mainnet Sign-Off Checklist

- Token and vault are pausable and pause cannot be bypassed.
- Dangerous admin actions are protected by timelock after setup.
- Setup window is short and ownership moves to treasury/Safe.
- Operator and custodian are separate addresses.
- External contract allowlist contains only verified Morpho, USDC, IRM, oracle, and approved integrations.
- Daily withdrawal limit and borrow LTV safety margin are conservative.
- Security report passes for the asset before publish and before borrow.
- Circuit breaker activates on owner/oracle/allowlist/balance anomalies.
- No deployer key retains custody powers after ownership transfer.

## External Auditor Sign-Off

Each mainnet release with real capital must include:

- Auditor name and organization.
- Commit hash reviewed.
- Finding list and severity.
- Remediation commits.
- Explicit approval or rejection for mainnet capital.
