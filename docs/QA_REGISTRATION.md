# QA checklist — Registro de inversores

Manual verification after Pre-QA + polish fixes, audit v3, readiness geo-block, and Sprint fixes (pre-check fail-closed, Didit PENDING UX, OAuth-only login, OnboardingStatusProvider, invite phone prefill).

**Estado:** checklist actualizado — ejecutar manualmente en **staging** antes de producción.

## Verificación automatizada (ejecutar antes del QA manual)

```bash
cd SANOVA-RWA/apps/web && npm test -- registerService.test.ts investorService.test.ts investorInviteService.test.ts registerEmailPrecheck.test.ts oauthRegistrationPolicy.test.ts totpOnboardingFlow.test.ts resolveOnboardingStepParam.test.ts middlewarePolicy.test.ts accessPageErrors.test.ts
cd SANOVA-RWA/apps/web && npx tsc --noEmit
```

Esperado: todos los tests passing, `tsc` sin errores. Cubre pre-check email, cuentas deshabilitadas, deep-link onboarding, geo-block IP parity (OAuth = password), middleware y errores de acceso.

## Geo-block estricto (password + OAuth)

- [ ] Desde IP/país bloqueado (`BLOCKED_REGISTRATION_COUNTRIES`, p. ej. IR): registro **password** rechazado (`REGION_NOT_AVAILABLE` en pre-check y POST `/api/auth/register`)
- [ ] Misma IP bloqueada: registro **OAuth** rechazado → redirect `/acceso?error=REGION_NOT_AVAILABLE` (no confiar en cookie `sanova.country` antigua de otro país)
- [ ] Cookie `sanova.country=AR` + IP bloqueada IR → **ambos** canales bloqueados (OAuth ya no usa cookie para el gate)

## Desktop

- [ ] `/acceso/registro` → email + password + **un solo checkbox** de términos → auto-login → `/kyc?registered=1`
- [ ] Registro **OAuth** desde `/acceso/registro` → mismo banner paso 2/5 (`registered=1` en callback)
- [ ] `/acceso/registro` **sin OAuth configurado** → no aparece divider huérfano “O continuá con Google…”
- [ ] `/acceso/registro` **con OAuth** → un checkbox de términos; divider solo si hay Google/Apple; OAuth funciona tras aceptar términos
- [ ] Onboarding banner: ~10 min + DNI/pasaporte + celular
- [ ] Post-registro: banner **“Paso 2 de 5: confirmá tu contacto (~10 min en total)”**
- [ ] Onboarding contacto: titular **“Confirmá tu contacto”** también en sub-paso OTP email (no cambia a “Verificá tu email” como H1)
- [ ] Onboarding: teléfono → OTP email → Didit → pagos Privy → TOTP (QR → confirm → backup codes)
- [ ] Paso Pagos Privy: cerrar modal o error API → botón **Reintentar configuración de pagos** (no spinner infinito)
- [ ] Resume card en `/acceso` enlaza al sub-paso pendiente (`?step=email|identity|wallet|totp`)
- [ ] **Banner marketplace** (`AccountStatusBanner`) enlaza al **mismo sub-paso pendiente** que resume card
- [ ] Progress labels: **Contacto / Identidad / Pagos / Seguridad** (5 pasos unificados en copy; no “Billetera”)
- [ ] Usuario incompleto logueado puede browse `/marketplace` sin redirect a `/kyc`
- [ ] Checkout/carrito redirige a onboarding si la cuenta no es operativa
- [ ] `/acceso?error=REGION_NOT_AVAILABLE` muestra mensaje de región
- [ ] TOTP paso 5: botón "Empezar de cero" visible en desktop y móvil
- [ ] TOTP paso 5: textos en EN y ES según locale (no hardcoded español)
- [ ] TOTP: si el polling de activación falla → mensaje **`TOTP_ACTIVATION_PENDING`**, **sin redirect** automático al marketplace
- [ ] TOTP backup: refrescar en paso backup → códigos aún visibles desde sessionStorage hasta “Continuar”

## Móvil / PWA

- [ ] Mismo flujo de registro desde `/acceso/registro`
- [ ] PWA registro muestra TrustBadges + links legales + link "Volver al inicio"
- [ ] TOTP abre Google Authenticator en paso `provision` (no flujo desktop QR)
- [ ] Browse marketplace permitido con sesión incompleta

## OAuth / compliance

- [ ] OAuth en **`/acceso/registro`**: exige checkbox de términos antes de Google/Apple (checkbox compartido con formulario password)
- [ ] Login **`/acceso`**: mantiene checkbox OAuth propio (sin cambios)
- [ ] OAuth desde región bloqueada rechazado (`REGION_NOT_AVAILABLE`)
- [ ] `/acceso?error=INVESTOR_ACCESS_NOT_ENABLED` muestra mensaje dedicado
- [ ] `/acceso?error=TERMS_NOT_ACCEPTED` si OAuth sin aceptar términos
- [ ] OAuth sin teléfono → captura teléfono en paso contacto de `/kyc`
- [ ] Cuenta deshabilitada no se re-habilita solo por registrar password (sin invite/pre-aprobación)
- [ ] Cuenta deshabilitada **tampoco** entra por OAuth (`INVESTOR_ACCESS_NOT_ENABLED`)
- [ ] Cuenta deshabilitada **tampoco** entra por login password (`INVESTOR_ACCESS_NOT_ENABLED` en step1)
- [ ] Registro password de cuenta deshabilitada muestra `INVESTOR_ACCESS_NOT_ENABLED` (no “código inválido”)
- [ ] **Invite ACCEPTED + cuenta deshabilitada:** pre-check email **no** bloquea falsamente (submit permitido)
- [ ] **OAuth-only deshabilitada:** pre-check muestra mensaje accionable (`OAUTH_ONLY_DISABLED`); **sin** link “Iniciá sesión” ni “Ya tengo cuenta”; **botones Google/Apple deshabilitados**
- [ ] Pre-check bloqueado (`REGION_NOT_AVAILABLE`, `INVESTOR_ACCESS_NOT_ENABLED`, `EMAIL_CHECK_FAILED`): submit password y OAuth **ambos** deshabilitados
- [ ] Email invite `?email=` dispara pre-check al cargar (sin esperar blur)
- [ ] Submit registro ejecuta pre-check aunque el usuario no haya hecho blur en el email
- [ ] Pre-check falla **cerrado** si hay error de red (`EMAIL_CHECK_FAILED`; botón Crear cuenta deshabilitado)
- [ ] `REGION_NOT_AVAILABLE` en pre-check **deshabilita** submit (no solo mensaje)
- [ ] Login password con cuenta **OAuth-only** → mensaje `OAUTH_ONLY_SIGN_IN_REQUIRED` (no “credenciales inválidas”)
- [ ] Resume card muestra **~X min restantes** según pasos pendientes
- [ ] Tras retorno Didit (`?didit=1`) con KYC `PENDING`: banner “Procesando verificación” y **sin** botón relanzar Didit
- [ ] KYC `PENDING` (sin retorno Didit): banner “en revisión” y polling de status
- [ ] Invite con teléfono en admin → paso contacto **pre-llena** teléfono sugerido
- [ ] Registro: **un solo** “Paso 1 de 5” (sin duplicado en formulario)
- [ ] OAuth buttons: cancelar popup no deja botones en loading permanente
- [ ] Inversor **operativo** logueado visita `/acceso/registro` → redirect a marketplace/`returnTo`, **no** a `/kyc` (esperar carga de status)

## Seguridad / API gates (Post Pre-QA)

- [ ] Admin deshabilita `investorAccessEnabled` → registro password **no** re-habilita cuenta
- [ ] Checkout API sin TOTP activo retorna error (`TOTP_REQUIRED` / `ACCOUNT_NOT_OPERATIONAL`)
- [ ] `session.update({})` fuerza recomputo server-side — **no** pasar `accountOperational: true` desde el cliente
- [ ] JWT API se renueva en sesión activa (>11h) — onboarding no falla por token expirado mid-flujo
- [ ] Completar onboarding sin TOTP no marca cuenta operativa (polling fallback eliminado)

## Invitaciones

- [ ] Admin invite persiste `phone` en `TeamInvite` (validación E.164 al crear)
- [ ] Accept invite pre-fill `User.phone` si estaba vacío
- [ ] Invite **ACCEPTED** aplica teléfono aunque `expiresAt` haya vencido
- [ ] Invite **ACCEPTED** (post-expiry) concede acceso en registro/OAuth vía `hasValidInvestorInviteForEmail`
- [ ] Email invite → `/acceso/registro?email=` funciona

## Didit / archivo KYC

- [ ] Webhook Didit siempre crea/actualiza `KycVerification` con JSON raw
- [ ] Webhook con contacto pendiente marca `pendingContact=true` y re-procesa al completar contacto
- [ ] Didit antes de contacto: webhook pending → completar contacto → KYC aplicado
- [ ] Privy path: email verificado vía wallet → KYC pending se aplica (`maybeReprocessPendingKyc`)
- [ ] Reprocess pending aplica solo la fila candidata (APPROVED más reciente), no sesiones viejas REJECTED
- [ ] Media Didit (portrait + document scans) en Storage con filas `KycDocument` **antes** de provision investor
- [ ] `Investor.portraitPath` se actualiza tras subir portrait
- [ ] `User.kycPersonalNumber`, `kycIssuingState`, `kycPortraitPath` poblados
- [ ] `Investor` sincronizado con teléfono, DOB, nacionalidad, portrait
- [ ] **Demo KYC (staging/dev):** `POST /api/onboarding/demo-kyc` crea fila `KycVerification` (`sessionId: demo-{userId}`, `provider: DIDIT`, `status: APPROVED`) + `kycPortraitPath` demo — requiere asset `kyc-documents/demo/placeholder.jpg` (o `DEMO_KYC_PORTRAIT_PATH`) en bucket staging para premios demo

## Premios

- [ ] Campaña `ACTIVE` + KYC aprobado + snapshot completo → `POST /api/prizes/enter` crea `PrizeEntry`
- [ ] Entrada rechazada si falta phone, fullName o portraitPath (`CONTACT_*_REQUIRED`)
- [ ] OAuth `image` **no** aceptado como portrait — solo `kycPortraitPath`

## Verificación DB (post KYC aprobado)

```sql
SELECT u.email, u.phone, u.kycPortraitPath, i.portraitPath, i.fullName
FROM "User" u
LEFT JOIN "Investor" i ON i.id = u."investorId"
WHERE u.email = 'test@example.com';

SELECT status, "pendingContact", "sessionId"
FROM "KycVerification"
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'test@example.com');
```

## Automatizado

```bash
cd SANOVA-RWA/apps/web && npm test -- registerService.test.ts investorService.test.ts investorInviteService.test.ts registerEmailPrecheck.test.ts oauthRegistrationPolicy.test.ts totpOnboardingFlow.test.ts resolveOnboardingStepParam.test.ts middlewarePolicy.test.ts accessPageErrors.test.ts
cd SANOVA-RWA/apps/web && npx tsc --noEmit
```

### Cobertura automatizada Pre-QA + polish + audit v3 + readiness

| Fix | Test |
|-----|------|
| H1 disabled-account bypass | `registerService.test.ts` |
| H2 TOTP en checkout API | `investorService.test.ts` |
| M1 portrait KYC only | `prizeService.test.ts` (snapshot) |
| M1 invite ACCEPTED post-expiry | `investorInviteService.test.ts` |
| G2/G3 register email pre-check | `registerEmailPrecheck.test.ts` |
| Geo-block OAuth = IP header | `oauthRegistrationPolicy.test.ts` |
| Resume deep-link step | `resolveOnboardingStepParam.test.ts` |
| TOTP confirm mode | `totpOnboardingFlow.test.ts` |
| Middleware browse vs checkout | `middlewarePolicy.test.ts` |
| OAuth/access errors | `accessPageErrors.test.ts` |

## Deploy staging (post-push)

1. Push a `main` → Vercel preview/staging se despliega automáticamente (o `vercel deploy` manual).
2. Ejecutar **este checklist completo** en la URL de staging.
3. Prioridad: happy path password + OAuth, geo-block, Didit/Privy/TOTP, checkout sin TOTP.
4. Verificar item **inversor operativo en `/acceso/registro`** (fix M1).

**Gate staging:** todos los ítems críticos marcados antes de promover a producción.

## Deploy producción (solo si staging OK)

Criterios obligatorios:

- [ ] QA manual staging completo sin blockers
- [ ] Didit webhook + Storage verificados en staging
- [ ] Geo-block smoke password + OAuth en staging
- [ ] Asset `kyc-documents/demo/placeholder.jpg` en bucket si se usa demo KYC

Promover deployment de staging a producción solo cuando los cuatro criterios estén cumplidos.
