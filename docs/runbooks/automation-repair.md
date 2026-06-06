# Runbook: repair de automatización

## Síntomas

- `automationCircuitBreaker` = true
- `automationFailureCount` ≥ 5
- Jobs `FAILED` en `AutomationJob`
- Alertas email/Slack: *Circuit breaker activo*

## Diagnóstico

```bash
npx tsx scripts/repair-asset-automation.ts --project <PROJECT_ID>
```

Revisar `deploymentEvents` con step `CIRCUIT_BREAKER` o jobs con `error`.

## Remediación

1. **Causa raíz**: gas, RPC, treasury, Morpho oracle, nonce — ver mensaje del job
2. Corregir env en Vercel (`TOKEN_DEPLOY_PRIVATE_KEY`, `BASE_RPC_URL`, `MORPHO_ORACLE_ADDRESS`, etc.)
3. Admin UI → **Reparar automatización**
4. Si el breaker quedó activo, reset manual en DB solo tras corregir causa:

```sql
UPDATE "Project"
SET "automationCircuitBreaker" = false, "automationFailureCount" = 0
WHERE id = '<PROJECT_ID>';
```

5. Re-encolar: guardar activo o `POST /api/admin/assets/{id}/repair-automation`

## Alertas

- Email: `AUTH_ADMIN_EMAILS`
- Slack: `AUTOMATION_SLACK_WEBHOOK_URL`
- Sentry: `SENTRY_DSN` (jobs fallidos + crons)

## Referencias

- `scripts/repair-asset-automation.ts`
- `apps/web/src/lib/admin/automationCircuitBreaker.ts`
- `apps/web/src/app/api/admin/assets/[projectId]/repair-automation/route.ts`
