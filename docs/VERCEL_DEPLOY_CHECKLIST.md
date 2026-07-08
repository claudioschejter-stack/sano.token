# SANOVA — Checklist de deploy en Vercel

URL producción: https://www.sanovacapital.com

Usá este documento antes de cada deploy a producción. Las variables marcadas **CRÍTICAS** bloquean registro, login, KYC o pagos si faltan.

## 1. Pre-deploy (local)

```bash
cd SANOVA-RWA
npm install
npm run db:generate
npm run typecheck
npm run test -w @sanova/web
npm run build -w @sanova/web
```

> **Build local:** requiere `DATABASE_URL` accesible en `apps/web/.env.local` (Prisma/Postgres).  
> **No confundir:** `SUPABASE_KEY` (JWT REST/Storage) ≠ contraseña de Postgres.  
> Verificar: `npm run verify:supabase`  
> Si la DB no responde, el build falla en `/api/marketplace/feed` por timeout.

- [ ] `npm run typecheck` sin errores
- [ ] `npm run test -w @sanova/web` pasa (incluye tests TOTP en `accountStatus.test.ts`)
- [ ] `npm run build -w @sanova/web` completa sin fallos
- [ ] Migraciones Prisma aplicadas en Supabase (`db:push` o pipeline CI)

## 2. Auth y registro — CRÍTICAS

| Variable | Requerida | Notas |
|----------|-----------|-------|
| `AUTH_SECRET` | Sí | ≥32 caracteres; sesiones NextAuth |
| `AUTH_INTERNAL_SECRET` | Sí | JWT interno API |
| `JWT_SECRET` | Sí | Tokens de acceso |
| `DATABASE_URL` | Sí | Pooler Supabase (pgBouncer) |
| `DIRECT_URL` | Sí | Migraciones Prisma |
| `TOTP_ENCRYPTION_KEY` | **Sí** | Hex ≥32 bytes; cifra secrets TOTP |
| `TOTP_ISSUER` | Opcional | Default: `Sanova Capital` |
| `INVESTOR_OPEN_REGISTRATION` | Sí | `true` o invite codes |
| `INVESTOR_INVITE_CODES` | Si registro cerrado | Códigos separados por coma |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sí | CAPTCHA login/registro |
| `TURNSTILE_SECRET_KEY` | Sí | Verificación server-side |

### WebAuthn / passkeys (móvil PWA)

| Variable | Requerida |
|----------|-----------|
| `WEBAUTHN_RP_ID` | `sanovacapital.com` |
| `WEBAUTHN_ORIGIN` | `https://www.sanovacapital.com` |
| `WEBAUTHN_RP_NAME` | Display name en biometría |

## 3. Privy wallet — CRÍTICAS

| Variable | Requerida | Notas |
|----------|-----------|-------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Sí | Dashboard Privy |
| `NEXT_PUBLIC_PRIVY_CUSTOM_AUTH` | **Sí = `true`** | Sync silencioso NextAuth → Privy |
| `PRIVY_APP_SECRET` | Sí | Server-side; nunca en cliente |
| JWKS en Privy Dashboard | Sí | `https://auth.privy.io/api/v1/apps/{APP_ID}/jwks.json` |

## 4. KYC (Didit) — CRÍTICAS

| Variable | Requerida |
|----------|-----------|
| `DIDIT_API_KEY` | Sí |
| `DIDIT_WEBHOOK_SECRET` | Sí |
| `ALLOW_DEMO_KYC` | `false` en prod |

Webhook Didit debe apuntar a: `https://www.sanovacapital.com/api/webhooks/didit`

Diagnóstico rápido en producción:

- Admin → Configuración → **Probar Didit**
- O: `cd apps/web && npx vercel env run --environment production -- node ../../scripts/vercel/test-didit-session.mjs`

El workflow KYC está en código (`INVESTOR_KYC_WORKFLOW_ID` en `apps/web/src/lib/onboarding/diditWorkflows.ts`), no en variables de entorno.

## 5. Email / OTP

| Variable | Requerida |
|----------|-----------|
| `RESEND_API_KEY` | Sí (emails transaccionales) |
| `ONBOARDING_FROM_EMAIL` | Sí |
| `CONTACT_FROM_EMAIL` | Sí |

## 6. Pagos Argentina — según rails activos

| Variable | Rail |
|----------|------|
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Webhook MP |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Checkout embebido |
| `MODO_WEBHOOK_SECRET` | MODO QR |
| `RIPIO_API_KEY` + `RIPIO_CLIENT_ID/SECRET` | Ripio on-ramp |
| `DLOCAL_GO_MERCHANT_ID` / `DLOCAL_GO_OPEN_LINK_TOKEN` | dLocal Go |

Verificar webhooks:
- `https://www.sanovacapital.com/api/webhooks/mercadopago`
- `https://www.sanovacapital.com/api/webhooks/modo`
- `https://www.sanovacapital.com/api/webhooks/ripio` (si aplica)

Scripts de verificación:
```bash
npm run vercel:check-payments
npm run vercel:verify-payments
```

## 7. Storage admin (launches)

| Variable | Requerida |
|----------|-----------|
| `SUPABASE_URL` | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí |
| `SUPABASE_STORAGE_BUCKET` | `launches` |

## 8. Blockchain / treasury (operaciones)

| Variable | Uso |
|----------|-----|
| `BASE_RPC_URL` / `LENDING_BASE_RPC_URL` | Lectura on-chain |
| `PRIVY_TREASURY_WALLET_ID` | Ops treasury |
| `PRIVY_OPERATOR_WALLET_ID` | Deploy tokens |
| `TOKEN_TREASURY_ADDRESS` | Multisig treasury |
| `CRON_SECRET` | Jobs programados |

## 9. URLs y dominio

| Variable | Valor prod |
|----------|------------|
| `AUTH_URL` | `https://www.sanovacapital.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.sanovacapital.com` |
| `NEXT_PUBLIC_API_URL` | URL Nest worker (si aplica) |

OAuth redirect URIs en Google/Apple:
- `https://www.sanovacapital.com/api/auth/callback/google`
- `https://www.sanovacapital.com/api/auth/callback/apple`

## 10. Post-deploy smoke test

Seguir `docs/PRODUCTION_E2E_CHECKLIST.md`:

1. Registro → KYC → wallet Privy → TOTP Sanova Capital → dashboard
2. Login desktop: email → contraseña → código 6 dígitos
3. PWA instalada: shell azul #009EE3 + bottom nav
4. Depósito Mercado Pago / Ripio (según país)
5. Rol INVESTOR no accede a `/dashboard/investors`

## 11. Comandos Vercel útiles

```bash
# Ver env de producción (requiere Vercel CLI linkeado)
vercel env ls production

# Pull env a local (cuidado: no commitear .env)
vercel env pull .env.local --environment=production

# Deploy preview
vercel

# Promover a producción
vercel --prod
```

## 12. Rollback

1. Vercel Dashboard → Deployments → deployment anterior → **Promote to Production**
2. Si hubo migración DB incompatible, revertir migración manualmente en Supabase antes del rollback de código

---

**Última revisión:** alineado con plan auth/acceso (TOTP obligatorio, login desktop/móvil, PwaShell, theme toggle).
