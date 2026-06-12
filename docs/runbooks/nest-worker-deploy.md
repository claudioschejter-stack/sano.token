# Runbook: Nest worker (listener + SSE)

## Por qué

Vercel web **no** ejecuta el listener RPC ni SSE de dividendos. Eso vive en `apps/api` (Nest).

## Opción A — Docker local / VPS

```bash
# Desde la raíz del monorepo
docker compose up postgres redis api -d
curl http://localhost:3001/api/v1/health
```

Variables mínimas en `.env` o exportadas:

- `DATABASE_URL` (misma DB que Vercel web)
- `BLOCKCHAIN_RPC_URL` / `BASE_RPC_URL`
- `BLOCKCHAIN_LISTENER_ENABLED=true`
- `JWT_SECRET`, `AUTH_INTERNAL_SECRET` (≥32 chars)

## Opción B — Producción (Railway / Fly / VPS)

1. Build imagen con `Dockerfile.api`
2. Exponer puerto **3001** con HTTPS (ej. `https://sanova-api.railway.app`)
3. Mismas env que docker-compose + secrets de producción
4. En Vercel **web**, setear:

```env
NEXT_PUBLIC_API_URL=https://sanova-api.railway.app
```

```bash
npm run vercel:sync-nest-api-url
```

5. Redeploy web en Vercel

## Verificación

- `GET https://<nest-host>/api/v1/health` → 200
- `GET https://<nest-host>/api/v1/finance/stream` → SSE (desde admin con sesión si aplica)
- En web prod: DevTools → Network → `EventSource` a `/api/v1/finance/stream` sin error permanente
- Tabla `BlockchainEvent` recibe filas tras transfers on-chain

## Errores comunes

| Síntoma | Causa |
|---------|--------|
| SSE 502 en Vercel | `NEXT_PUBLIC_API_URL` vacío o Nest caído |
| Listener no indexa | `BLOCKCHAIN_LISTENER_ENABLED=false` o sin RPC |
| Auth Nest falla | Usar `AUTH_ADMIN_EMAILS` + `AUTH_ADMIN_PASSWORD` (mismo que web) |
