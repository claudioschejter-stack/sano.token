# Runbook: estado parcial ERC-4626

## Síntomas

- `tokenDeployStatus` = `PENDING` o `DEPLOYED` pero `vaultAddress` vacío
- `vaultFundingStatus` ≠ `FUNDED`
- Collateral Morpho no `REGISTERED`
- `isActive` = false aunque el admin publicó

## Diagnóstico

1. Admin → activo → pestaña **Deployment events**
2. Revisar pasos: `TOKEN_DEPLOY`, `VAULT_DEPLOY`, `COLLATERAL_REGISTER`, `LAUNCH_FINALIZE`
3. Tabla `AutomationJob` (step + status + error)

## Remediación

### Deploy async (producción)

1. Guardar de nuevo con **Emitir on-chain** si el token aún no está desplegado
2. Esperar polling UI (`tokenDeployStatus` sale de `PENDING`)
3. Cron `process-automation-jobs` drena la cola (08:00 UTC) o kick en background al encolar

### Repair manual

```bash
npx tsx scripts/repair-asset-automation.ts --project <PROJECT_ID>
```

O desde admin: **Reparar automatización** → `POST /api/admin/assets/{id}/repair-automation`

### Gates que bloquean publish

- Treasury shares listas (`assertTreasuryVaultSharesReady`)
- Morpho oracle + collateral `REGISTERED`
- Circuit breaker inactivo

## Referencias

- `apps/web/src/lib/admin/erc4626LaunchPipeline.ts`
- `apps/web/src/lib/admin/automationJobs.ts`
