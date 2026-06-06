# Runbook: Morpho collateral SUBMITTED

## Síntomas

- `collateralTargets` protocolo `MORPHO` con `status` = `SUBMITTED` (no `REGISTERED`)
- `readyToBorrow` = false
- Admin muestra *Enviado — revisión institucional*

## Diagnóstico

1. Admin → activo → sección collateral / Morpho
2. Ver `oracleAddress`, `marketId`, `deploymentEvents` step `COLLATERAL_REGISTER`
3. Script: `npm run verify:morpho-borrow`

## Remediación

### Re-intentar registro on-chain

Admin → **Registrar collateral** → `POST /api/admin/assets/{id}/register-collateral`

### Pipeline automático

Tras `TOKEN_DEPLOY` async, el job `COLLATERAL_REGISTER` se encadena solo. Si falló:

```bash
npx tsx scripts/repair-asset-automation.ts --project <PROJECT_ID>
```

### Env requerido

- `MORPHO_CHAIN_ID`, `MORPHO_ORACLE_ADDRESS`
- `MORPHO_DEFAULT_LLTV_BPS`
- Vault ERC-4626 desplegado y con dirección en el proyecto

### SUBMITTED prolongado

Si el protocolo externo requiere curación manual, mantener `SUBMITTED` hasta confirmación off-chain; no forzar `REGISTERED` en DB sin tx válida.

## Referencias

- `apps/web/src/lib/collateral/collateralOrchestrator.ts`
- `apps/web/src/components/admin/AdminLaunchEditor.tsx`
- `scripts/verify-morpho-borrow-ready.ts`
