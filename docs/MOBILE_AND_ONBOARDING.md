# Sanova — App móvil, Didit y cuenta operativa

## Objetivo

La plataforma está pensada **primero para celular**: onboarding con teléfono grande, botones fijos abajo y flujo guiado. La cuenta queda **operativa** solo cuando se cumplen las tres condiciones:

1. **Email verificado** (código de 6 dígitos por Resend)
2. **Teléfono verificado** (código SMS por Twilio)
3. **Identidad aprobada** (DNI / pasaporte + prueba de vida vía [Didit](https://didit.me/products/free-kyc/))

Hasta entonces el inversor se redirige a `/kyc?returnTo=/marketplace`.

## Didit (recomendado — 500 verificaciones gratis/mes)

1. Crear organización en [business.didit.me](https://business.didit.me/)
2. Crear workflow **KYC** con: OCR (documento), Liveness pasivo, Face Match
3. En **API & Webhooks** copiar API Key y registrar webhook:
   - URL: `https://sano-token-web.vercel.app/api/webhooks/didit`
   - Eventos: `status.updated`, `data.updated` (v3)
4. Variables en Vercel:

```env
DIDIT_API_KEY=""
DIDIT_WORKFLOW_ID=""
DIDIT_WEBHOOK_SECRET=""
```

5. El usuario inicia sesión → `/kyc` → pasos email/teléfono → **Verificar con Didit** → Didit abre cámara en el móvil (DNI, pasaporte, selfie).
6. El webhook guarda en `User`: `kycFullName`, `kycDocumentId` (desde `decision.id_verifications`). El admin los ve en `/dashboard/team` junto con email/teléfono verificados.

Documentación: [Quick Start Didit](https://docs.didit.me/getting-started/quick-start)

## Email y SMS

| Canal | Proveedor | Variable |
|-------|-----------|----------|
| Email OTP | [Resend](https://resend.com) | `RESEND_API_KEY`, `ONBOARDING_FROM_EMAIL` |
| SMS OTP | [Twilio](https://www.twilio.com) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |

En desarrollo, con `ONBOARDING_DEV_EXPOSE_CODE=true` los códigos se muestran en pantalla (no usar en producción).

## App en Google Play y Apple App Store

La web ya es **PWA** (`manifest.json`, service worker). Para tiendas:

### Opción A — Rápida (recomendada para MVP)

- **Android**: [Trusted Web Activity (TWA)](https://developer.chrome.com/docs/android/trusted-web-activity/) con [PWABuilder](https://www.pwabuilder.com/) apuntando a `https://sano-token-web.vercel.app`
- **iOS**: “Add to Home Screen” + más adelante envoltorio **Capacitor** si necesitás App Store

### Opción B — Nativa híbrida

- [Capacitor](https://capacitorjs.com/) sobre el build Next.js: mismo onboarding y Didit en WebView/fullscreen
- Didit también ofrece SDK móvil si más adelante querés UI 100% nativa

Pasos típicos Capacitor:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Sanova RWA" com.sanova.rwa
npx cap add ios
npx cap add android
```

Configurar `server.url` a producción o empaquetar estático según estrategia de deploy.

## Migración de base de datos

Tras actualizar el schema Prisma:

```bash
npm run db:generate
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

## Rutas API nuevas

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/onboarding/status` | Checklist del inversor logueado |
| POST | `/api/onboarding/contact` | Guardar teléfono y enviar códigos |
| POST | `/api/onboarding/verify-email` | Validar código email |
| POST | `/api/onboarding/verify-phone` | Validar código SMS |
| POST | `/api/onboarding/didit/session` | Crear sesión Didit y obtener URL |
| POST | `/api/webhooks/didit` | Webhook de resultado KYC |
| POST | `/api/onboarding/demo-kyc` | Solo demo (deshabilitado en prod salvo `ALLOW_DEMO_KYC=true`) |

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

**Pendiente siguiente fase:** checkout con CTA fijo abajo, tablas admin en cards, PWABuilder/Capacitor para tiendas.

## Próximos pasos sugeridos

- Ejecutar `cd apps/web && npm run pwa:icons` y commitear los PNG generados
- Sumar `phone` al registro OAuth / creación de inversor en admin
- Bloquear checkout en servidor si `accountStatus !== OPERATIONAL`
- Integrar estado KYC de Didit también en `Investor` para on-chain whitelist automática
