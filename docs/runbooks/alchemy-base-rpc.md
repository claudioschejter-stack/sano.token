# Configurar Alchemy como RPC de Base

**Por qué:** el endpoint público (`mainnet.base.org`) limita las ráfagas de `eth_call`.
Ethers reporta ese estrangulamiento como `missing revert data`, que es indistinguible
de un contrato que revierte. El reporte de seguridad RWA leía eso como "la dirección
no está permitida" e inventaba violaciones de allowlist que bloqueaban activos reales.

## 1. Crear la app en Alchemy

1. Entrar a [dashboard.alchemy.com](https://dashboard.alchemy.com) → **Apps** → **Create new app**.
2. Nombre: `sanova-base-prod` (o similar).
3. Chain: **Base**, network **Base Mainnet** (chain id `8453`).
4. Crear y abrir **API Key**. Copiar la key (el string solo, no la URL).

El endpoint que Alchemy expone es `https://base-mainnet.g.alchemy.com/v2/<API_KEY>`.
No hace falta armarlo a mano: la plataforma lo construye desde la key.

## 2. Cargar la variable en Vercel

Vercel → proyecto `sano-token-web` → **Settings** → **Environment Variables**.

| Name | Value | Environments |
|---|---|---|
| `ALCHEMY_API_KEY` | la key sola | Production, Preview, Development |

Alcanza con esa. Si preferís pegar la URL completa, usá `ALCHEMY_BASE_RPC_URL` en
lugar de la key; si están las dos, gana la URL.

**No marcar como "Sensitive"** si querés poder leerla después desde el dashboard;
en cualquier caso nunca se imprime: todo lo que la plataforma reporta pasa por
`maskRpcUrl`, porque la key viaja dentro de la URL.

## 3. Revisar que no quede un endpoint público pisándolo

En el mismo panel, buscar `BASE_RPC_URL`, `LENDING_BASE_RPC_URL`,
`NEXT_PUBLIC_BASE_RPC_URL` y `BLOCKCHAIN_RPC_URL`.

Si alguna tiene `https://mainnet.base.org`, lo más limpio es **borrarla**. No es
obligatorio: `resolveBaseMainnetRpcUrls()` pone cualquier endpoint dedicado antes
que uno público, sin importar de qué variable venga, justamente porque
`scripts/vercel/sync-lending-env.mjs` escribía el público como default y eso
habría convertido el alta de Alchemy en un no-op silencioso.

`NEXT_PUBLIC_BASE_RPC_URL` se inyecta en el bundle del browser, así que **no**
poner ahí la URL de Alchemy con la key: quedaría pública. Para el cliente, dejarla
vacía o con un endpoint público.

## 4. Redeploy

Las variables de entorno se toman en el build. Vercel → **Deployments** →
**Redeploy** en el último de Production.

## 5. Verificar

```bash
# Que el endpoint responda y esté en Base (0x2105 = 8453)
curl -s -X POST "https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# → {"jsonrpc":"2.0","id":1,"result":"0x2105"}
```

Contra la plataforma, el chequeo real es que el reporte de seguridad deje de
marcar checks como ilegibles. El script de ops avisa sobre qué RPC corre:

```bash
ALCHEMY_API_KEY=... DATABASE_URL="$POSTGRES_URL" \
  npx tsx scripts/ops/inspect-rwa-security-timelocks.ts
```

Si sale la línea `RPC: endpoint público de Base`, la variable no llegó.

## 6. Límites

El plan free de Alchemy alcanza de sobra para lo que hace la plataforma: el cron
diario hace del orden de 150 lecturas por corrida. Lo que importa no es el volumen
mensual sino el **rate limit por segundo**, que es lo que rompía el reporte al
leer varios contratos seguidos.

## Qué NO configurar acá

`ALCHEMY_WEBHOOK_SIGNING_KEY`, `ALCHEMY_WEBHOOK_ID` y `ALCHEMY_NOTIFY_AUTH_TOKEN`
son de Alchemy Notify (webhooks de actividad on-chain), no del RPC. Están cargadas
en Vercel pero no declaradas en `turbo.json`; es un pendiente aparte.
