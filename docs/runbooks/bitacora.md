# Bitácora: qué se registra y por qué se registraba de menos

## El principio

La cadena es la fuente de verdad; `TokenMovement` es su índice consultable. Cada fila es idempotente sobre `(txHash, logIndex)`, así que reindexar nunca duplica historia.

## Las tres razones por las que faltaban movimientos

### 1. El filtro de USDC conocía muy pocas direcciones

USDC es demasiado activo para indexarlo entero, así que se filtra por dirección. Ese filtro tenía la tesorería de tokens y las wallets guardadas en `User.walletAddress`. Nada más.

Todo lo que ocurría entre otras direcciones **desaparecía sin dejar rastro**: la renta pagada desde la tesorería de stablecoins, la liquidez enviada a Morpho, el gas movido entre operadores, y cualquier movimiento de una wallet Privy que no se hubiera escrito de vuelta en `User`.

Ahora el filtro es `platformAddressRegistry`, que enumera cada dirección que la plataforma controla u opera, con su rol. Sumar una wallet operativa nueva es una línea, y desde ese momento todos sus movimientos se ven. La completitud pasa a ser una propiedad de construcción en lugar de algo que se descubre faltando.

### 2. La ventana era fija y los huecos eran permanentes

El indexador escaneaba 40.000 bloques hacia atrás desde la punta, unas 22 horas en Base, contra un cron diario. Cualquier corrida salteada o fallida dejaba un hueco que nadie volvía a mirar.

Ahora la propia bitácora es el cursor: el bloque más alto ya registrado para un contrato es donde arranca el próximo escaneo. No hay tabla extra que mantener sincronizada, y un hueco se cierra en la corrida siguiente. Con un tope por corrida, para que una caída larga no genere un escaneo sin límite.

### 3. Los préstamos no son transferencias

Pedir y devolver prestado no es una transferencia ERC-20 de ningún token nuestro, y el colateral se mueve dentro de Morpho. Mirando contratos de tokens esos movimientos **no se pueden ver nunca**.

`indexMorphoMovements` lee los eventos de Morpho y se queda con los de nuestros mercados. Un mercado se reconoce por su id registrado; Morpho aloja miles de mercados ajenos.

## Qué se registra

| Movimiento | Tipo | Fuente |
|---|---|---|
| Inversor paga USDC | `USDC_PAYMENT` | Transferencias + escritura al liquidar |
| Renta y rendimientos al inversor | `USDC_RENT_PAYOUT` | Transferencias |
| Movimientos internos de tesorería | `USDC_TREASURY_TRANSFER` | Transferencias |
| Gas cobrado en USDC | `USDC_GAS_FEE` | Escritura al liquidar |
| Devoluciones | `USDC_REFUND` | Escritura del admin |
| Emisión y quema de shares | `RWA_SHARE_MINT` / `_BURN` | Eventos del vault |
| Entrega de shares al inversor | `RWA_SHARE_DELIVERY` | Eventos del vault |
| Otras transferencias de shares | `RWA_SHARE_TRANSFER` | Eventos del vault |
| Liquidez a Morpho y retiro | `MORPHO_SUPPLY` / `_WITHDRAW` | Eventos de Morpho |
| Préstamo y devolución | `MORPHO_BORROW` / `_REPAY` | Eventos de Morpho |
| Colateral entrando y saliendo | `MORPHO_COLLATERAL_IN` / `_OUT` | Eventos de Morpho |
| Liquidación | `MORPHO_LIQUIDATION` | Eventos de Morpho |

Antes todo movimiento de USDC se guardaba como `USDC_PAYMENT`, así que la bitácora sabía que el dinero se movió pero no si fue una compra, una renta o liquidez. Un registro que hay que interpretar movimiento por movimiento no es una bitácora; ahora la clasificación surge de los roles de las dos puntas.

## Operación

```
GET /api/cron/index-token-movements     → corre los dos indexadores
```

Cada uno corre aislado: que uno falle no le cuesta al otro su pasada, porque una pasada perdida solía dejar un hueco permanente.

## Cómo agregar una wallet operativa

Sumala en `platformAddressRegistry` con su rol. Si el rol es nuevo y merece su propia clasificación, agregalo también en `classifyMovement`. No hace falta tocar el indexador.

## Lo que sigue pendiente

Las escrituras desde la aplicación (liquidación de pago, devoluciones) son de mejor esfuerzo: si fallan, se registra el error y sigue. Hoy eso está cubierto porque el indexador ve el mismo movimiento on-chain, así que la fila aparece igual en la pasada siguiente. Si en el futuro se agrega un movimiento que **solo** exista como escritura de aplicación, hay que darle reintento propio.
