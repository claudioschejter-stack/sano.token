# SANOVA — Checklist E2E manual (producción)

URL: https://www.sanovacapital.com

Marcá cada ítem al validarlo. Reportá fallos con captura + email de prueba usado.

## 1. Registro e onboarding

- [ ] Registro con email + teléfono + contraseña (Turnstile invisible)
- [ ] Email de verificación / flujo Privy
- [ ] KYC Didit completa y vuelve al portal
- [ ] Wallet Privy embebida vinculada
- [ ] TOTP obligatorio: QR Google Authenticator issuer **Sanova Capital**
- [ ] En celular: registrar passkey (huella/Face ID) al final del paso TOTP
- [ ] Backup codes descargados / guardados
- [ ] Dashboard accesible solo con onboarding completo

## 2. Login desktop (sin PWA)

- [ ] Paso 1: email válido → paso contraseña
- [ ] Paso 2: contraseña correcta + TOTP → sesión OK
- [ ] TOTP incorrecto → mensaje de intentos / bloqueo 15 min
- [ ] Theme toggle claro/oscuro en sidebar

## 3. Login móvil (navegador + PWA)

- [ ] **Navegador móvil sin instalar**: shell celeste MP (#009EE3), bottom nav, sin sidebar desktop
- [ ] Pantalla inicial login: **biometría / Face ID primero** (sin depender de hint previo)
- [ ] Fallback email + password + TOTP 6 dígitos
- [ ] Instalar app (banner o menú compartir iOS) — misma UX que navegador móvil
- [ ] Passkey / Face ID → si TOTP activo, pide código 6 dígitos
- [ ] Durante onboarding (post-TOTP en celular): prompt registrar passkey antes de entrar

## 3b. UX móvil tipo Mercado Pago

- [ ] `/dashboard`: saldo, APY, acciones Ingresar/Retirar, **propiedades reales del marketplace** (no cards marketing)
- [ ] `/marketplace`: listado compacto con APY, tokens disponibles, precio/token
- [ ] `/dashboard/cash-flow`: KPIs rentas + historial en cards blancas
- [ ] `/dashboard/portfolio` o wallet: depósito / retiro / historial estilo MP
- [ ] Tab **Perfil** → `/dashboard/settings/security`
- [ ] Páginas secundarias (checkout, carrito): legibles con tema claro (override terminal)

## 4. Seguridad

- [ ] Usuario KYC aprobado **no puede desactivar** TOTP
- [ ] Passkey **no** crea sesión sin TOTP cuando `totpEnabled=true`
- [ ] Rutas admin bloqueadas para rol INVESTOR

## 5. Pagos (según rails activos)

- [ ] Ripio on-ramp PRODUCTION → USDC en treasury → depósito confirmado
- [ ] Mercado Pago aprobado → intent/deposit en MANUAL_REVIEW + cola treasury
- [ ] MODO aprobado → misma cola treasury
- [ ] Webhooks responden 200 (Vercel logs / Supabase)

## 6. Ops

- [ ] `/dashboard/operations` — treasury, Morpho, operador en verde
- [ ] Vercel env: `TOTP_ENCRYPTION_KEY`, `TOTP_ISSUER`, Supabase, Privy, Didit

## Credenciales de prueba sugeridas

Usá un email dedicado (`+sanova` alias) y anotá:
- Email / teléfono
- ¿TOTP activo?
- ¿Passkey registrado?
- ¿KYC status?
