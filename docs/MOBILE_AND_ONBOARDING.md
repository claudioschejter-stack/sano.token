# Sanova — App móvil, Didit y cuenta operativa

## Objetivo

La plataforma está pensada **primero para celular**: onboarding con teléfono grande, botones fijos abajo y flujo guiado. La cuenta queda **operativa** solo cuando se cumplen las condiciones de identidad, wallet y TOTP (inversores).

Hasta entonces el inversor se redirige a `/kyc?returnTo=/marketplace`.

## Didit (recomendado — 500 verificaciones gratis/mes)

### Checklist de configuración (Didit + Vercel)

**Consola Didit — [business.didit.me](https://business.didit.me/)**

1. Crear workflow **KYC** activo con: OCR (documento), Liveness pasivo, Face Match
2. El UUID del workflow **KYC + AML** está en código (`INVESTOR_KYC_WORKFLOW_ID` = `1fabc54a-646c-474a-abad-7f164ff2c33f` en `diditWorkflows.ts`), no en variables de entorno
3. En **API & Webhooks**:
   - Copiar **API Key** del mismo proyecto/app
   - Webhook URL: `https://www.sanovacapital.com/api/webhooks/didit`
   - Eventos: `status.updated`, `data.updated` (v3)
   - Copiar **Webhook Secret**
4. Verificar créditos/plan disponibles en la cuenta Didit

**Vercel Production — proyecto `sano-token-web`**

| Variable | Valor esperado |
|----------|----------------|
| `NEXT_PUBLIC_SITE_URL` | `https://www.sanovacapital.com` |
| `AUTH_URL` | `https://www.sanovacapital.com` |
| `DIDIT_API_KEY` | API Key de Didit |
| `DIDIT_WEBHOOK_SECRET` | Secret del webhook Didit |
| `ALLOW_DEMO_KYC` | `false` |

Redeploy obligatorio después de cambiar variables.

### Probar Didit sin DevTools en el celular

1. **Admin → Configuración → Probar Didit** (desktop, sesión admin)
2. O desde CLI con secretos de producción:

```bash
cd apps/web
npx vercel env run --environment production -- node ../../scripts/vercel/test-didit-session.mjs
```

Si la prueba falla con HTTP 401 → revisar `DIDIT_API_KEY`. Si falla con 404 → revisar el workflow KYC en `diditWorkflows.ts`. Si falla con 400 y mensaje de créditos → recargar en business.didit.me.

### Flujo del inversor

1. Registro desktop → activación por email → QR **Continuá en tu celular**
2. Móvil: `/kyc` → contacto (teléfono + huella) → **Validar identidad con teléfono celular**
3. Didit abre cámara (DNI/pasaporte + selfie) → retorno a `/kyc?didit=1`
4. Webhook actualiza KYC en `User` (`kycFullName`, `kycDocumentId`, etc.)

Documentación: [Quick Start Didit](https://docs.didit.me/getting-started/quick-start)

## Email

| Canal | Proveedor | Variable |
|-------|-----------|----------|
| Email transaccional / activación | [Resend](https://resend.com) | `RESEND_API_KEY`, `ONBOARDING_FROM_EMAIL` |

En desarrollo, con `ONBOARDING_DEV_EXPOSE_CODE=true` los códigos se muestran en pantalla (no usar en producción).

## App en Google Play y Apple App Store

La web ya es **PWA** (`manifest.json`, service worker). Para tiendas:

### Opción A — Rápida (recomendada para MVP)

- **Android**: [Trusted Web Activity (TWA)](https://developer.chrome.com/docs/android/trusted-web-activity/) con [PWABuilder](https://www.pwabuilder.com/) apuntando a `https://www.sanovacapital.com`
- **iOS**: “Add to Home Screen” + más adelante envoltorio **Capacitor** si necesitás App Store

### Opción B — Nativa híbrida

- [Capacitor](https://capacitorjs.com/) sobre el build Next.js: mismo onboarding y Didit en WebView/fullscreen
- Didit también ofrece SDK móvil si más adelante querés UI 100% nativa

## Rutas API relevantes

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/onboarding/status` | Checklist del inversor logueado |
| POST | `/api/onboarding/contact` | Guardar teléfono |
| POST | `/api/onboarding/didit/session` | Crear sesión Didit y obtener URL |
| POST | `/api/webhooks/didit` | Webhook de resultado KYC |
| POST | `/api/admin/integrations/didit-test` | Diagnóstico Didit (solo admin) |
| POST | `/api/onboarding/demo-kyc` | Solo demo (deshabilitado en prod) |

## Configuración móvil (portal + PWA)

Implementado en `apps/web`:

| Área | Archivos |
|------|----------|
| Perfiles de ruta / FAB | `src/lib/mobile/deviceConfig.ts` |
| Barra inferior inversor/asesor | `src/components/layout/PortalMobileNav.tsx`, `src/lib/mobile/portalMobileNav.ts` |
| Shell portal | `src/app/(portal)/layout.tsx` — `min-h-dvh`, `safe-x`, `pb-nav-safe`, banner PWA |
| Viewport + iconos | `src/app/layout.tsx` — zoom permitido, metadata icons |
| Utilidades CSS | `src/app/globals.css` — `safe-*`, `pb-nav-safe`, `touch-manipulation` |
| Iconos PWA | `npm run pwa:icons` (genera PNG desde `public/icons/icon.svg`) |

**Barra inferior (solo móvil):** Panel · Marketplace · Mis activos · Flujo de caja (inversor) o Clientes · Cartera (asesor). Admin sigue con menú hamburger.
