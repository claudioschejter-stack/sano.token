# Pasos manuales pendientes

Lo que no se puede hacer desde el código, con el porqué de cada uno. Ordenado por
impacto.

---

## 1. Cargar `CRON_EXTERNAL_SECRET` como secret del repo en GitHub

**Por qué importa:** los crons nativos de Vercel corren **una vez por día** porque
el plan Hobby no permite más. Eso es lo que hace que un pago cobrado espere hasta
24 h para acreditarse, que una reserva vencida bloquee stock, y que la reparación
de seguridad RWA tarde dos días en converger (una corrida agenda el timelock, otra
lo aplica).

El camino rápido de los pagos **no** depende de esto: el webhook de Alchemy avisa
cuando llega el USDC y liquida en segundos. Los crons son la red de seguridad.

**No hace falta pagar Pro.** El repo ya resolvía esto a medias:
`CRON_EXTERNAL_SECRET` existe en `authorizeCronRequest` con un comentario que dice
textualmente que es para un scheduler externo que pinga más seguido que el límite
de Hobby, y `.github/workflows/watch-crypto-deposits.yml` ya lo usaba para un
endpoint. `scheduled-maintenance.yml` lo extiende al resto. Para un curl de
segundos, GitHub Actions es gratis.

Los `crons` de `apps/web/vercel.json` quedan **puestos a propósito** como red de
seguridad diaria: si el workflow se desactiva, el sistema funciona un día tarde en
vez de no funcionar.

**Pasos:**

1. Sacar el valor de `CRON_EXTERNAL_SECRET` de Vercel → **Settings** →
   **Environment Variables**. Si no existe, generarlo con `openssl rand -hex 32` y
   cargarlo ahí primero.
2. GitHub → repo → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**, con nombre exactamente `CRON_EXTERNAL_SECRET`.
3. **Actions** → *Scheduled maintenance (free cron)* → **Run workflow**,
   eligiendo `watch-awaiting-treasury-usdc`, para comprobar que responde
   `HTTP 200`. Un **401** significa que el secret no coincide con el de Vercel.

**Las frecuencias y su criterio**, para que se puedan discutir:

| Endpoint | Frecuencia | Por qué |
|---|---|---|
| `watch-crypto-deposits` | 5 min (ya existía) | Depósitos cripto que el webhook no vio. |
| `watch-awaiting-treasury-usdc` | 10 min | Red de seguridad de los pagos fiat. Cada minuto es plata cobrada con tokens sin entregar. |
| `process-automation-jobs` | 15 min | Es la cola: su latencia se suma a todo lo demás. |
| `expire-stale-reservations` | 2 h | Una reserva vencida bloquea stock que otro inversor podría comprar. |
| `refresh-borrow-rates` | 6 h | Reporte y reparación de seguridad, y el aviso de esquema atrasado. Con timelock de 1 h en el vault, cuatro corridas por día convergen el mismo día. |
| `sync-deposit-watch` | 6 h | Re-declara la lista de direcciones del webhook, por si se recreó. |
| `index-token-movements` | 4 h | Reconciliación, no bloquea a nadie. |

**Tres límites de GitHub Actions**, para no descubrirlos en producción:

- los schedules **se retrasan** bajo carga; no hay garantía de puntualidad,
- cuando el retraso es grande, GitHub **descarta la corrida** en lugar de
  encolarla,
- en un repo sin actividad por **60 días** los desactiva y avisa por mail.

El segundo mordió el primer día. El workflow tenía cinco entradas de `cron`, una
por grupo de endpoints, y las tres poco frecuentes (`25 */2`, `40 */6`, `50 */4`)
**no dispararon ni una vez**: los schedules frecuentes sobreviven porque tienen
seis oportunidades por hora, pero uno de cuatro por día se pierde entero. Por eso
la reparación de seguridad RWA no corría nunca por este camino, y las dos únicas
corridas del 10/08 salieron del cron diario de Vercel.

Ahora hay **un solo schedule** de 10 minutos y el reparto se decide adentro del
job, según la hora UTC: las ventanas duran una hora entera, así que si se cae un
tick, otro de la misma hora agarra la ventana. Puede haber más de una corrida por
ventana, y no importa: todos estos endpoints son idempotentes.

| Hora UTC | Qué se dispara además de las dos de cada corrida |
|---|---|
| par | `expire-stale-reservations` |
| múltiplo de 4 | `index-token-movements` |
| 0, 6, 12, 18 | `refresh-borrow-rates`, `sync-deposit-watch` |

**Costo:** los repos públicos no consumen minutos; los privados tienen 2000
min/mes gratis. Este workflow usa del orden de 15 min/mes.

---

## 2. El webhook de depósitos ya se sincroniza solo

**Qué hacía falta antes:** el webhook de Alchemy es lo que hace que un depósito se
acredite en segundos. Solo notifica las direcciones de su lista, y **Alchemy no
informa cuáles ya vigila**, así que no se puede verificar por consulta. Peor:
recrear el webhook la vacía en silencio, con el dinero del inversor esperando.

**Ahora** `/api/cron/sync-deposit-watch` re-declara la lista completa cada 6 h
desde el workflow. Re-declarar es idempotente, así que el caso "se recreó el
webhook y nadie se enteró" se arregla solo en menos de seis horas.

Para correrlo a mano: **Actions** → *Scheduled maintenance* → **Run workflow** →
`sync-deposit-watch`. O `POST /api/admin/deposit-watch` con sesión de admin, que
sigue existiendo.

Si responde `ALCHEMY_WEBHOOK_NOT_MANAGED`, faltan `ALCHEMY_NOTIFY_AUTH_TOKEN` o
`ALCHEMY_WEBHOOK_ID` en el entorno.

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

### Estado de la reparación de seguridad (2026-08-10, 12:00 UTC)

La reparación **está funcionando y avanzando sola**. Corrió dos veces el 10/08
(02:56 y 08:16 UTC) y en esas dos corridas ya arregló todo lo que tenía timelock
corto:

- El **límite diario del vault de UV3** pasó de `uint256.max` a 500 tokens. Se ve
  en el `BALANCE_MONITOR` de las 08:15:56 (`dailyLimit=115792089…`) contra el de
  las 08:16:17 (`dailyLimit=500000000000000000000`).
- Las **cuatro allowlists del vault de UV3** también se aplicaron: desaparecieron
  del reporte de las 08:16.

Lo que queda son las allowlists a nivel token, que tienen timelock de 24 h y ya
están agendadas con hora exacta:

| Asset | Qué falta | Aplicable desde |
|---|---|---|
| `UV3RWA` | 4 allowlists del token | `2026-08-11T02:56:01Z` |
| `ANELOUV2` | 2 allowlists (token y vault) | `2026-08-11T02:56:33Z` |

**Los dos breakers siguen activos, y se liberan solos en la primera corrida de
`refresh-borrow-rates` posterior a esas horas.** No hay nada que decidir ni
ejecutar a mano: el timelock ya está iniciado y la corrida siguiente lo aplica.

Un detalle contraintuitivo: el contador de fallos de los dos assets está en `0`.
El breaker no se activó por fallos repetidos de automatización sino por el reporte
de seguridad, que es otro camino.

### Sobre `unknown` y la key de Alchemy

El reporte distingue tres estados por chequeo: `ok`, `fail` y `unknown`. `unknown`
es "no pude leer la cadena", y por diseño **no activa ni libera** el breaker:
activar sobre una lectura fallida daría falsos positivos, y liberar sería peor.

Eso hacía temer que sin `ALCHEMY_API_KEY` el breaker quedara trabado para siempre.
En la práctica no está pasando: los reportes del 10/08 devuelven `fail` concretos
con direcciones y montos, no `unknown`, y la reparación pudo leer y escribir en la
cadena. Las lecturas andan. La key sigue valiendo la pena por cuota y latencia,
pero no es lo que bloquea la liberación.

Para ver los timelocks pendientes con su hora de ejecución sin esperar el mail:

```bash
ALCHEMY_API_KEY=... DATABASE_URL="$POSTGRES_URL" \
  npx tsx scripts/ops/inspect-rwa-security-timelocks.ts
```

---

## 4. Borrar de Vercel las variables de los proveedores retirados

Ninguna la lee nadie, así que no urge: no rompen nada y no cambian el
comportamiento. Ensucian el panel y el build las reporta como no declaradas en
`turbo.json`.

Vercel → **Settings** → **Environment Variables** → borrar:

```
DLOCAL_API_KEY            DLOCAL_SECRET_KEY
DLOCAL_X_TRANS_KEY        DLOCAL_NOTIFICATION_SECRET
DLOCAL_SMARTFIELDS_API_KEY
DLOCAL_API_BASE_URL       DLOCAL_CHECKOUT_BASE_URL
DLOCAL_GO_MERCHANT_ID     DLOCAL_GO_OPEN_LINK_TOKEN

STRIPE_SECRET_KEY         STRIPE_WEBHOOK_SECRET
COINBASE_COMMERCE_API_KEY COINBASE_COMMERCE_WEBHOOK_SECRET
RAMP_WEBHOOK_SECRET       BINANCE_PAY_API_KEY
EBANX_WEBHOOK_SECRET      EBANX_API_BASE_URL
ASTROPAY_WEBHOOK_SECRET
WISE_API_KEY              WISE_RECEIVE_USD_DETAILS
WISE_RECEIVE_EUR_DETAILS  WISE_RECEIVE_GBP_DETAILS
STABLECOIN_CUSTODIAL_WALLET_ADDRESS
```

Las de dLocal salieron en #138, el resto en #151 y #152. `COINBASE_ADVANCED_TRADE_API_KEY`
**se queda**: es del rail de conversión de yield, que no tiene nada que ver con el
checkout de Coinbase Commerce.

---

## 5. Pedirle a Macro lo que falta provisionar

Las credenciales de sandbox funcionan: `POST /sesion` responde *"Identificación del
comercio correcta."* con un token de cuatro horas. Se comprueba con
`npm run ops:check-macro`. Pero el comercio está incompleto y eso bloquea tres cosas
que no se arreglan desde el código.

**Escribir a `recaudacionesmda@macro.com.ar`** por el comercio
`eb27e93a-4cf9-4d43-8a27-0543b3cfedde` pidiendo:

1. **Provisionar una sucursal.** Sin ella, `/link-pago`, `/qr` y `/caja` devuelven
   `No se encontró la sucursal para el comercio`. No es un campo que se pueda mandar:
   se probaron `sucursal`, `sucursal_id`, `sucursalComercio`, `branch_id` y
   `SucursalComercio`, y el mensaje no cambia. La API la busca del lado del comercio.
2. **Habilitar el medio de pago de billetera**, si se quiere cobrar con MODO por QR.
   Hoy `GET /payment-methods` devuelve nueve tarjetas y DEBIN, y ninguna billetera:

   ```
   Visa Crédito, Maestro Débito, Mastercard crédito, Visa Débito, DEBIN,
   Cabal Débito, Tarjeta Naranja, AMEX, Cabal Crédito, Mastercard débito
   ```

3. **Un CBU o alias de prueba válido** para DEBIN. Con uno inventado la llamada pasa
   la validación de campos y muere en `Ocurrió un error al realizar el pago.`, porque
   no hay cuenta real de la que debitar.

Lo que **sí** funciona sin nada de esto es el formulario del checkout, que es el
camino que usa el marketplace: cobra con cualquiera de las nueve tarjetas. DEBIN
además no depende de la sucursal, así que es el rail de transferencia que menos
provisión necesita: le falta sólo el CBU de prueba.

Y hay que declarar del lado de Macro la **URL de notificación**, que no viaja en el
formulario:

```
https://<dominio>/api/webhooks/macro-click
```

Para simular una notificación a mano hace falta `MACRO_CLICK_SKIP_IP_CHECK=true`,
porque el webhook sólo acepta los rangos de IP de Macro. Sólo en preview.

---

## 6. Aplicar migraciones cuando el aviso llegue

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

### Estado de `_prisma_migrations` (2026-08-09)

Limpio: 29 archivos, 29 filas, cero pendientes, cero checksums divergentes, cero
duplicados. `migrate deploy` corre sin quejarse.

Lo que había y se corrigió, por si vuelve a aparecer el patrón:

- `20260701000000_user_preferences_theme_pwa` tenía el **checksum vacío**: la fila
  se insertó a mano sin calcularlo. Se escribió el hash del archivo, después de
  verificar que las tres columnas que declara existen en la base.
- `20260626000000_add_totp_2fa` tenía **dos filas**, ambas con el checksum correcto
  — un registro repetido, probablemente un `migrate resolve --applied` sobre algo
  que ya estaba registrado. Se conservó la que tiene una ventana real de aplicación
  y se borró la otra.

El criterio en los dos casos fue el mismo: **el archivo es la verdad y la base ya
lo refleja**, así que se corrige el registro, no el esquema. Antes de tocar
`_prisma_migrations` conviene comprobar que los objetos que declara la migración
—columnas, tablas, índices, constraints— efectivamente existan. Si no existen, el
problema es al revés y hay que aplicar el SQL, no ajustar el checksum.

---

## 7. Decisiones de negocio que bloquean código

- **Renombrar UV2 y UV3 para que se distingan.** No son un duplicado: son dos
  edificios distintos en Añelo, con tokens, vaults e inversores separados.

  | Proyecto | Símbolo | Token | Vendidos |
  |---|---|---|---|
  | `proj-apart-hotel-urban-view-anelo-mplonxbv` | `ANELO UV2 RWA` | `0x1dD753…` | 0 de 5000 |
  | `proj-anelo-apart-hotel-urban-view` | `UV3RWA` | `0x481fAa…` | 2 de 5000 |

  El problema es que sus títulos tienen **las mismas palabras en otro orden** —
  "APART HOTEL URBAN VIEW - AÑELO" y "AÑELO - APART HOTEL URBAN VIEW" — y ninguno
  menciona UV2 ni UV3. Las alertas ya se desambiguan solas con el símbolo del
  token, pero el inversor sigue viendo dos títulos indistinguibles en el
  marketplace. Conviene que digan UV2 y UV3. Es una decisión de producto: el
  título es lo que se publica.

  De paso: el nombre del token de UV2 dice `URVAN VIEW` en lugar de `URBAN VIEW`.
  El typo está **en la cadena y es inmutable** (ERC-20 no permite renombrar), así
  que la base se alineó a lo que dice el contrato en vez de mostrar algo distinto.
  Se decidió dejarlo así.
- **Fondear el CVU de Ripio con los ARS que cobra Macro.** No hay API de payout
  Macro→Ripio, así que hoy es una transferencia manual. Hay que definir quién la
  hace y con qué frecuencia, o el on-ramp queda creado esperando fiat.
- **Payouts de Bridge.** Fondear `BRIDGE_WALLET_ID` y recién entonces poner
  `BRIDGE_PAYOUTS_ENABLED=true`.
- **Bitso Business.** Si se evalúa, entra en `fiatRailPolicy`, no en cada panel.
