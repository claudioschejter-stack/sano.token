# Runbook: Nest worker (listener + SSE)

## Por qué

Vercel web **no** ejecuta el listener RPC ni SSE de dividendos de forma fiable (timeouts de proxy). Eso vive en `apps/api` (Nest) en Railway:

`https://sanovaapi-production.up.railway.app`

El browser debe conectar EventSource a Nest (vía `NEXT_PUBLIC_API_URL`). Las rewrites `/api/v1/*` en `next.config.js` son fallback server-side.

## Opción A — Docker local / VPS

```bash
# Desde la raíz del monorepo
docker compose up postgres redis api -d
curl http://localhost:3001/api/v1/health/live
```

Variables mínimas en `.env` o exportadas:

- `DATABASE_URL` (misma DB que Vercel web)
- `BLOCKCHAIN_RPC_URL` / `BASE_RPC_URL`
- `BLOCKCHAIN_LISTENER_ENABLED=true`
- `JWT_SECRET`, `AUTH_INTERNAL_SECRET` (≥32 chars)
- `FRONTEND_ORIGINS` con orígenes del portal (`https://www.sanovacapital.com`, …)

Local web:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

(dev sin Docker suele usar `PORT=4000` → `http://localhost:4000`)

## Opción B — Producción (Railway)

IDs por defecto (override con env):

| Var | Default |
|-----|---------|
| `RAILWAY_PROJECT_ID` | `a5014ffc-130f-4d2f-9c7b-84fd651d9f55` |
| `RAILWAY_ENVIRONMENT_ID` | `bb37162b-725f-40a2-885d-9ac18fb6dfbc` |
| `RAILWAY_SERVICE_ID` | `8d5680aa-768f-45ff-9c50-f61363a0578a` |

```bash
# Auth
export RAILWAY_TOKEN=…          # o: npx @railway/cli login --browserless
export VERCEL_TOKEN=…           # o: npx vercel login

# Deploy Nest + sync NEXT_PUBLIC_API_URL (production/preview/development) + redeploy web
npm run railway:deploy-nest
```

Pasos manuales equivalentes:

1. Build imagen con `Dockerfile.api` / `railway up`
2. Exponer HTTPS en `https://sanovaapi-production.up.railway.app` (o dominio custom)
3. Mismas env que `scripts/railway/sync-nest-env.mjs` + secrets de producción
4. En Vercel **web**:

```env
NEXT_PUBLIC_API_URL=https://sanovaapi-production.up.railway.app
```

```bash
npm run vercel:sync-nest-api-url
```

5. Redeploy web en Vercel (la URL es `NEXT_PUBLIC_*` → build-time)

## Verificación

```bash
npm run vercel:verify-nest
curl -sS https://sanovaapi-production.up.railway.app/api/v1/health/live
```

- `GET /api/v1/health/live` → 200 `{ status: "ok" }`
- `GET /api/v1/health` → 200 (DB up; Redis skipped si `BULL_ENABLED=false`)
- Admin → **Operations** → checks `NEXT_PUBLIC_API_URL` + `Nest worker health/live`
- En web prod: DevTools → Network → `EventSource` a `https://sanovaapi-production.up.railway.app/api/v1/finance/stream` (no same-origin Vercel)
- Tabla `BlockchainEvent` recibe filas tras transfers on-chain

## Errores comunes

| Síntoma | Causa |
|---------|--------|
| SSE corta / 502 en Vercel | EventSource pasó por rewrite Vercel; falta `NEXT_PUBLIC_API_URL` o redeploy web |
| `429 rate limited` + `server: railway-hikari` | Rate limit de edge por IP (no es Nest). Reintentar desde otra red o redeploy |
| Listener no indexa | `BLOCKCHAIN_LISTENER_ENABLED=false` o sin RPC |
| Auth Nest falla | Usar `AUTH_ADMIN_EMAILS` + `AUTH_ADMIN_PASSWORD` (mismo que web) |
| CORS en SSE | Falta origen del portal en `FRONTEND_ORIGINS` del worker |
