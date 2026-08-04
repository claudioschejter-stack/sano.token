# Arquitectura de billeteras Sanova

Objetivo: **multifirma en lo crítico, automático en lo habitual**, sin MetaMask ni llaves privadas en variables de entorno.

## Los tres niveles

### Nivel 1 — Governance Safe (multifirma)

Una sola dirección Safe es **owner de todos los tokens y vaults**.

| Puede | No puede |
|---|---|
| `mint`, `pause`, `unpause` | — |
| `transferOwnership` | — |
| habilitar/quitar módulos | — |
| mover fondos del treasury | — |

- Env: `GOVERNANCE_SAFE_ADDRESS` (por compatibilidad cae a `BASE_STABLECOIN_TREASURY_ADDRESS`)
- Threshold recomendado: **2 de 3**
- Signers sugeridos: 1 wallet Privy de servidor (para automatizaciones aprobadas), 2 humanas (hardware wallet / Safe móvil)

Con threshold 2, ninguna acción crítica puede ejecutarse desde el servidor solo.

### Nivel 2 — Operadores (wallets Privy de servidor, single-sig y con alcance limitado)

Cada rol es una wallet Privy distinta. Ninguna tiene poder de owner.

| Rol | Env | Alcance | Gas |
|---|---|---|---|
| Compliance (whitelist) | `PRIVY_OPERATOR_WALLET_ID` + `RWA_OPERATOR_ADDRESS` | solo `setKyc`, vía `SanovaKycOperatorModule` | ETH propio |
| Entrega de shares | mismo operador, vía `SanovaDeliveryOperatorModule` | solo `transfer` de vaults habilitados, y solo hacia inversores ya whitelisteados | ETH propio |
| Safe owner de operación | `PRIVY_SAFE_OWNER_WALLET_ID` + `TREASURY_OWNER_ADDRESS` | firma transacciones del Safe (setup de módulos, gobernanza) | ETH propio |
| Liquidez Morpho | `PRIVY_MORPHO_LIQUIDITY_WALLET_ID` | supply/withdraw en Morpho | ETH propio |

Los dos módulos son la pieza que permite tener las dos cosas a la vez: el Safe sigue siendo owner, y el operador solo puede aprobar inversores y entregarles sus shares.

### Nivel 3 — Inversores (wallets Privy embebidas)

Una por email, creada por el servidor. Paga su gas en USDC (Privy Transfer API, modo *User pays*) y cubre además el gas de la habilitación y la entrega (`RWA_INVESTOR_GAS_COVERAGE_USD`).

## Qué reemplaza a MetaMask

| Rol histórico de la EOA `0x7AC277Cd…` | Reemplazo |
|---|---|
| Owner de tokens y vaults | Governance Safe |
| Owner del Safe legacy `0x5e7480c4…` | Se abandona: sus activos migran al Governance Safe |
| Firmante de deploys | Wallet Privy de deploy; el deploy transfiere ownership al Safe en el acto |

Una vez migrado todo, **borrar `TOKEN_DEPLOY_PRIVATE_KEY` y `TREASURY_OWNER_PRIVATE_KEY` de Vercel**.

## Migración y verificación

```
GET  /api/admin/asset-governance                  → auditoría de todos los activos
POST /api/admin/asset-governance { dryRun: true } → qué haría, sin firmar
POST /api/admin/asset-governance                  → migra ownership + habilita tokens en el módulo
```

La auditoría revisa, por proyecto:

- `owner()` del token y del vault es el Governance Safe
- el token está habilitado en el módulo KYC
- el módulo está habilitado en el Safe

`compliant: true` significa que el activo está bajo la arquitectura objetivo.

Sabe migrar desde dos orígenes: una EOA (con la llave de deploy) y un Safe legacy (ejecutando `transferOwnership` a través de ese Safe).

## Activos nuevos

El deploy ya transfiere ownership al treasury. Además, al terminar cada deploy de token o vault corre `applyGovernanceAfterDeploy`, que aplica y registra la gobernanza como evento `ASSET_GOVERNANCE` en el historial del proyecto. Un activo nuevo nace con el Safe como owner y el token habilitado en el módulo.

## Orden de migración

1. Fondear con ~0.005 ETH en Base las wallets Privy operativas
2. `POST /api/admin/asset-governance` (migra todo al Governance Safe)
3. `POST /api/admin/kyc-module-setup` (habilita el módulo de KYC y su alcance)
4. `POST /api/admin/delivery-module-setup` (habilita el módulo de entrega)
5. Guardar `KYC_OPERATOR_MODULE_ADDRESS` y `DELIVERY_OPERATOR_MODULE_ADDRESS` en Vercel
6. `GET /api/admin/platform-alignment` → `aligned: true` y `treasury.readyForMultisig: true`
7. Subir el Safe a **threshold 2** en la UI de Safe
8. Borrar las llaves privadas de Vercel

El paso 7 va al final a propósito, y depende del 6. Mientras el threshold sea 1 el servidor puede ejecutar la migración solo; con 2, todo lo que no pase por un módulo pide firma manual. `readyForMultisig` es exactamente la pregunta "¿puedo cerrar el Safe sin frenar el checkout?".

## Qué queda automático con threshold 2

| Proceso | Camino | Firma manual |
|---|---|---|
| Alta de inversor (`setKyc`) | módulo de KYC | no |
| Entrega de shares tras la compra | módulo de entrega | no |
| Pago del inversor en USDC | wallet del inversor (Transfer API) | no |
| Renta y rendimientos en USDC | wallet treasury Privy | no |
| Supply/withdraw en Morpho | wallet de liquidez | no |
| Deploy de token o vault nuevo | operador RWA, transfiere ownership al Safe al final | no |
| `mint`, `pause`, `transferOwnership` | Safe | **sí** |
| Habilitar módulos o ampliar su alcance | Safe | **sí** |
| Mover fondos del treasury fuera de los flujos anteriores | Safe | **sí** |

Los casos con firma manual son los que justifican la multifirma. El resto no la necesita.

## Por qué los módulos no rompen la multifirma

Un módulo de Safe ejecuta sin recolectar firmas — por eso importa que su alcance sea mínimo.

`SanovaKycOperatorModule` solo puede llamar `setKyc` sobre tokens que el Safe habilitó explícitamente, y solo desde operadores que el Safe autorizó.

`SanovaDeliveryOperatorModule` solo puede transferir shares de vaults que el Safe habilitó, y solo hacia direcciones que el token ya marcó `kycApproved`. Esa última condición es la que impide que un operador comprometido vacíe el Safe hacia una dirección propia: tendría que pasar antes por el alta de KYC. Además admite un tope por transacción por vault.

Ninguno de los dos puede mintear, pausar, transferir ownership, mover USDC ni ampliarse permisos a sí mismo.

## Activos nuevos: nada que hacer a mano

Al terminar cada deploy, `applyGovernanceAfterDeploy` deja el token bajo el Safe, lo habilita en el módulo de KYC y habilita el vault en el módulo de entrega. Un activo nuevo nace listo para venderse sin firma manual, y cada paso queda en el historial del proyecto como evento `ASSET_GOVERNANCE`.

Si algo falla (por ejemplo, el operador se quedó sin gas), el evento lo registra y se puede reconciliar cuando haga falta:

```
POST /api/admin/delivery-module-setup            → reconcilia todos los vaults
POST /api/admin/delivery-module-setup { "projectIds": ["<id>"] }
```

Es idempotente. `GET /api/admin/platform-alignment` avisa cuando falta algo.
