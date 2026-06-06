# Roadmap de correcciones (orden estricto)

No avanzar a la siguiente fase hasta verificar la anterior.

## Fase 1 — Infraestructura Nest + SSE + seguridad API (CRÍTICO)

- [x] `Dockerfile.api` corregido (sin `frontend/`, incluye `@sanova/blockchain`)
- [x] `docker-compose.yml` DB/Redis/listener alineados
- [x] Webhook Sumsub fail-closed en producción
- [x] Auth Nest alineado con `AUTH_ADMIN_EMAILS` + `AUTH_ADMIN_PASSWORD`
- [x] SSE con reconnect en `useRealTimeDividends`
- [x] Script `vercel:sync-nest-api-url` + runbook `nest-worker-deploy.md`
- [x] Typecheck api + web OK
- [ ] **Pendiente operativo:** desplegar Nest worker + `NEXT_PUBLIC_API_URL` en Vercel
- [ ] **Pendiente verificación:** `docker compose build api` (requiere Docker instalado)

## Fase 2 — Pipeline automation ERC-4626 (ALTO)

- [ ] Encolar `MORPHO_LIQUIDITY` en pipeline async
- [ ] Reaper jobs `RUNNING` huérfanos
- [ ] Cron automation más frecuente (hourly)
- [ ] `captureAutomationError` en cron yield
- [ ] Treasury policy fail-closed en timeout RPC

## Fase 3 — Seguridad, config y resiliencia (ALTO/MEDIO)

- [ ] Eliminar o implementar ruta `webhooks/ramp`
- [ ] Alinear env preview/staging (secrets obligatorios)
- [ ] Polling fallback dividendos si Nest caído
- [ ] Documentar rotación Slack/Sentry

## Fase 4 — CI, observabilidad y deuda (MEDIO/BAJO)

- [ ] Vitest en CI (web + blockchain)
- [ ] Sentry client sin romper build
- [ ] `.gitignore` artefactos `abi/*.js`
- [ ] Limpieza `apiClient` muerto + ABIs deprecated
