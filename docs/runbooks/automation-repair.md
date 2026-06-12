# Runbook: repair de automatización

## Síntomas

- `automationCircuitBreaker` = true (en metadata de deployment events, no columna SQL en `Project`)
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
4. Si el breaker quedó activo, reset vía API o script (no hay columnas `automationCircuitBreaker` / `automationFailureCount` en la tabla `Project`):

```bash
npx tsx scripts/repair-asset-automation.ts --project <PROJECT_ID>
# o desde admin:
# POST /api/admin/assets/{id}/repair-automation
```

Equivalente programático (persistido en `deploymentEvents` / AUTOMATION_META):

```typescript
import { clearAutomationFailures } from './apps/web/src/lib/admin/assetsService';
await clearAutomationFailures('<PROJECT_ID>');
```

5. Re-encolar: guardar activo o `POST /api/admin/assets/{id}/repair-automation`

## Alertas

- Email: `AUTH_ADMIN_EMAILS`
- Slack: `AUTOMATION_SLACK_WEBHOOK_URL`
- Sentry: `SENTRY_DSN` (jobs fallidos + crons)

## Referencias

- `scripts/repair-asset-automation.ts`
- `apps/web/src/lib/admin/automationCircuitBreaker.ts`
- `apps/web/src/lib/admin/assetsService.ts` (`clearAutomationFailures`)
- `apps/web/src/app/api/admin/assets/[projectId]/repair-automation/route.ts`
