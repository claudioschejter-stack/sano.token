# Mercados Morpho: la cadena es la fuente de verdad

## El problema que resuelve

Un mercado en Morpho se identifica por el hash de sus cinco parámetros: token prestado, colateral, oracle, modelo de interés y LLTV. Cambiá uno solo y es otro mercado, con otro id.

Durante un tiempo el id se **recalculaba** cuando no estaba registrado, usando el LLTV de `MORPHO_DEFAULT_LLTV_BPS` y el oracle guardado. Si el mercado real se había creado con otra combinación, el id calculado apuntaba a un mercado que no existe, cada lectura devolvía cero, y el activo quedaba marcado como sin liquidez mientras sus fondos seguían intactos en el mercado verdadero.

El síntoma es engañoso porque no hay error: se lee un mercado vacío, que es una respuesta válida.

## Cómo funciona ahora

**Primero se verifica el id que ya tenemos.** `verifyStoredMarket` lee `idToMarketParams` y confirma que el colateral del mercado sea nuestro vault. Son dos lecturas, es exacto y no asume ningún parámetro. Este es el camino normal.

**Si el id falta o apunta a otro vault, se descubre.** `discoverMarketsByCollateral` lee los eventos `CreateMarket` de Morpho y se queda con los que tienen alguno de nuestros vaults como colateral. Encuentra el mercado sea cual sea su LLTV u oracle, incluso si lo creó otra persona o si nuestros parámetros por defecto cambiaron después.

**Una lectura fallida no dispara un escaneo ni concluye nada.** Si no pudimos leer el id guardado, no sabemos si está bien o mal, así que no se toca nada.

**El id descubierto se guarda.** `reconcileMorphoMarkets` registra en `collateralTargets[].externalId` el mercado que la cadena dice que corresponde, y deriva `morphoLiquidityStatus` de ese mercado. Los valores guardados pasan a ser una caché reparable en vez de un dato que puede quedar mintiendo para siempre.

**Se reconcilia en conjunto, no de a uno.** Una sola pasada cubre todos los activos.

**Se autocorrige a diario.** El cron `refresh-borrow-rates` corre la reconciliación, así que un dato que quedó mal por un corte de red vuelve a la verdad sin intervención.

## Comandos

```
GET  /api/admin/morpho-reconcile      → qué dice la cadena, sin escribir nada
POST /api/admin/morpho-reconcile      → registra y corrige
POST /api/admin/morpho-reconcile { "projectIds": ["..."], "dryRun": true }
```

La respuesta trae, por proyecto, el id que tenía guardado, el que encontró en la cadena, la liquidez disponible y qué cambió.

Cuando un vault tiene más de un mercado, elige el de mayor liquidez disponible y lo dice en `actions`, para que la decisión quede visible en lugar de resolverse en silencio.

## Cómo leer el resultado

| Situación | Qué significa |
|---|---|
| `ya coincidía con la cadena` | Nada que hacer. |
| `liquidez: FAILED → LIQUID` | El estado guardado venía de una lectura fallida. |
| `id guardado collateral_mismatch` | El id apunta a un mercado de otro colateral; se buscó el correcto. |
| `market id corregido` | Se reemplazó por el que la cadena tiene. |
| `sin mercado en Morpho para este vault` | Se escaneó y no existe. Es trabajo pendiente, no un dato viejo. |
| `no se pudo determinar el mercado` | **No se pudo leer.** No afirma nada y no cambia nada. |

Esa última fila es la distinción que importa: "no encontré" y "no pude buscar" son cosas distintas. Confundirlas fue lo que declaró ausente un mercado con 656 USDC.

## Estados de liquidez

`LIQUID` y `NO_LIQUIDITY` describen el mercado. `FAILED` describe **nuestra lectura**, no el mercado, y por eso un fallo transitorio ya no lo escribe: deja el valor anterior y devuelve `UNKNOWN`. Confundir las dos cosas es lo que dejó dos activos marcados como ilíquidos con 500 USDC disponibles.

## Variables

| Variable | Para qué |
|---|---|
| `MORPHO_DEPLOY_BLOCK` | Desde dónde escanear eventos. Por defecto el bloque de despliegue de Morpho en Base. |
| `LENDING_BASE_RPC_URL` / `BASE_RPC_URL` | El escaneo de eventos necesita un RPC dedicado; los públicos limitan el rango. |
