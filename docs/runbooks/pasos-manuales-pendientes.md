# Pasos manuales pendientes

Lo que no se puede hacer desde el código, con el porqué de cada uno. Ordenado por
impacto.

---

## 1. Pasar Vercel a Pro y ajustar la frecuencia de los crons

**Por qué importa:** los nueve crons corren **una vez por día** porque el plan
Hobby no permite más. Eso no es una preferencia, es lo que hace que:

- la reparación de seguridad RWA tarde **dos días** en converger (una corrida
  agenda la acción con timelock, la siguiente la aplica),
- un alquiler cobrado espere hasta 24 h para distribuirse,
- una reserva vencida bloquee stock hasta 24 h de más,
- un pago fiat cuyo webhook falló espere hasta 24 h para que lo encuentre la red
  de seguridad.

El camino rápido de los pagos **no** depende de esto: el webhook de Alchemy avisa
cuando llega el USDC y liquida en segundos. Los crons son la red de seguridad.

**Pasos:**

1. Vercel → equipo → **Settings** → **Billing** → **Upgrade to Pro**.
2. En el repo, editar `apps/web/vercel.json` con estas frecuencias:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-borrow-rates", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/process-yield-batches", "schedule": "0 6 * * *" },
    { "path": "/api/cron/process-automation-jobs", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/migrate-treasury-to-privy", "schedule": "0 9 * * *" },
    { "path": "/api/cron/auto-distribute-rent", "schedule": "0 10 * * *" },
    { "path": "/api/cron/watch-crypto-deposits", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/watch-awaiting-treasury-usdc", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/expire-stale-reservations", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/index-token-movements", "schedule": "0 */4 * * *" }
  ]
}
```

**El criterio detrás de cada frecuencia**, para que se pueda discutir:

| Cron | Frecuencia | Por qué |
|---|---|---|
| `watch-awaiting-treasury-usdc` | 10 min | Es la red de seguridad de los pagos fiat. Cada minuto que tarda es plata cobrada con tokens sin entregar. |
| `watch-crypto-deposits` | 10 min | Igual, para depósitos cripto que el webhook no vio. |
| `process-automation-jobs` | 15 min | Es la cola: la latencia acá se suma a todo lo demás. |
| `expire-stale-reservations` | 30 min | Una reserva vencida bloquea stock que otro inversor podría comprar. |
| `refresh-borrow-rates` | 6 h | Incluye el reporte y la reparación de seguridad. Con timelock de 1 h en el vault, cuatro corridas por día alcanzan para converger el mismo día. |
| `index-token-movements` | 4 h | Reconciliación, no bloquea a nadie. |
| `process-yield-batches`, `auto-distribute-rent`, `migrate-treasury-to-privy` | diario | Son procesos de negocio con cadencia diaria; más seguido no aporta. |

3. Commit, merge y deploy. Vercel valida las expresiones cron en el build: si
   sigue en Hobby, el deploy falla con un error de límite de plan. Es decir, no
   hay riesgo de que quede a medias.

**Verificación:** Vercel → proyecto → **Settings** → **Cron Jobs** debe listar los
nueve con la nueva frecuencia y un "Next run" coherente.

---

## 2. Registrar las direcciones en el webhook de depósitos

**Por qué importa:** el webhook de Alchemy es lo que hace que un depósito se
acredite en segundos. Solo notifica las direcciones que tiene en su lista, y
**Alchemy no informa cuáles ya vigila**, así que no se puede saber por consulta si
está completo. Las billeteras nuevas se registran solas al crearse; las anteriores
a esa funcionalidad, y todas si el webhook se recreó, hay que recargarlas.

La treasury también está en la lista: el USDC que llega ahí es la segunda mitad de
un pago fiat.

**Pasos:**

1. Entrar al panel de admin de Sanova con una cuenta admin.
2. `GET /api/admin/db-readiness` primero, para confirmar que la base está al día.
3. `POST /api/admin/deposit-watch` sin cuerpo. Es idempotente: correrlo de más no
   hace daño.
4. La respuesta trae `registered` con la cantidad de direcciones enviadas.

Si responde `ALCHEMY_WEBHOOK_NOT_MANAGED`, faltan `ALCHEMY_NOTIFY_AUTH_TOKEN` o
`ALCHEMY_WEBHOOK_ID` en el entorno.

**Cuándo repetirlo:** cada vez que se recree el webhook en Alchemy. Al recrearlo
se pierde la lista y los depósitos vuelven a depender del cron, en silencio.

---

## 3. Rotar la key de Alchemy

Se compartió en un chat. Una key de RPC no da acceso a fondos, pero sí permite que
un tercero consuma la cuota.

1. [dashboard.alchemy.com](https://dashboard.alchemy.com) → app `sanova-base-prod`
   → **API Key** → **Rotate**.
2. Actualizar `ALCHEMY_API_KEY` en Vercel (Production, Preview, Development).
3. Redeploy.
4. Verificar con el inspector, que dice sobre qué RPC corre:

```bash
ALCHEMY_API_KEY=... DATABASE_URL="$POSTGRES_URL" \
  npx tsx scripts/ops/inspect-rwa-security-timelocks.ts
```

Si la primera línea dice `RPC: endpoint público de Base`, la variable no llegó.

---

## 4. Borrar de Vercel las variables de dLocal

Desde #138 no las usa nada. Siguen cargadas y el build las viene reportando como
no declaradas en `turbo.json`.

Vercel → **Settings** → **Environment Variables** → borrar:

```
DLOCAL_API_KEY            DLOCAL_SECRET_KEY
DLOCAL_X_TRANS_KEY        DLOCAL_NOTIFICATION_SECRET
DLOCAL_SMARTFIELDS_API_KEY
DLOCAL_API_BASE_URL       DLOCAL_CHECKOUT_BASE_URL
DLOCAL_GO_MERCHANT_ID     DLOCAL_GO_OPEN_LINK_TOKEN
```

---

## 5. Aplicar migraciones cuando el aviso llegue

`prisma migrate deploy` no está conectado a ningún pipeline, así que aplicar una
migración es un paso humano. El cron diario ahora manda una alerta crítica cuando
la base quedó atrás del código desplegado — antes eso solo se descubría cuando un
inversor recibía un 500.

Cuando llegue ese mail:

```bash
cd packages/database
DATABASE_URL="<url de producción>" DIRECT_URL="<url directa>" npm run db:migrate:deploy
```

**Ojo con la conexión:** el pooler de Supabase en modo transacción (puerto 6543) no
sirve para migrar, porque `migrate` necesita locks de sesión. Hay que usar la URL
directa (puerto 5432). Si esa no es alcanzable desde donde estés, se puede aplicar
el SQL de la migración a mano y registrar la fila en `_prisma_migrations` con el
checksum sha256 del archivo `migration.sql`.

**Deuda conocida:** dos migraciones de julio (`20260701000000_user_preferences_theme_pwa`
y `20260701120000_add_passkeys_webauthn`) tienen un checksum guardado distinto del
archivo actual, porque se editaron después de aplicarse. `migrate deploy` va a
rechazarlas por eso. Hay que decidir entre volver los archivos a su contenido
original o actualizar el checksum guardado; en ambos casos el efecto en la base ya
está aplicado.

---

## 6. Decisiones de negocio que bloquean código

- **Los dos proyectos Urban View duplicados.** `proj-anelo-apart-hotel-urban-view`
  tiene 2 tokens vendidos de 5000; `proj-apart-hotel-urban-view-anelo-mplonxbv`
  tiene 0 de 5000. Tokens y vaults distintos, cada uno alerta por separado y cada
  uno consume automatización. Hay que decidir cuál queda y desactivar el otro.
- **Fondear el CVU de Ripio con los ARS que cobra Macro.** No hay API de payout
  Macro→Ripio, así que hoy es una transferencia manual. Hay que definir quién la
  hace y con qué frecuencia, o el on-ramp queda creado esperando fiat.
- **Payouts de Bridge.** Fondear `BRIDGE_WALLET_ID` y recién entonces poner
  `BRIDGE_PAYOUTS_ENABLED=true`.
- **Bitso Business.** Si se evalúa, entra en `fiatRailPolicy`, no en cada panel.
