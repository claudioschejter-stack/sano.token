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
| Safe owner de operación | `PRIVY_SAFE_OWNER_WALLET_ID` + `TREASURY_OWNER_ADDRESS` | firma transacciones del Safe (entrega de shares) | ETH propio |
| Liquidez Morpho | `PRIVY_MORPHO_LIQUIDITY_WALLET_ID` | supply/withdraw en Morpho | ETH propio |

El módulo KYC es la pieza que permite tener las dos cosas: el Safe sigue siendo owner y el operador solo puede aprobar inversores en los tokens que el Safe habilitó.

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
3. `POST /api/admin/kyc-module-setup` (habilita el módulo y su alcance)
4. `GET /api/admin/asset-governance` → `compliant: true`
5. Subir el Safe a **threshold 2** en la UI de Safe
6. Borrar las llaves privadas de Vercel

El paso 5 va al final a propósito: mientras el threshold sea 1, el servidor puede ejecutar la migración solo. Con 2, cada paso pediría firma manual.

## Por qué el módulo no rompe la multifirma

Un módulo de Safe ejecuta sin recolectar firmas — por eso importa que su alcance sea mínimo. `SanovaKycOperatorModule` solo puede llamar `setKyc` sobre tokens que el Safe habilitó explícitamente, y solo desde operadores que el Safe autorizó. No puede mintear, pausar, transferir ownership ni mover fondos, y no puede ampliarse permisos a sí mismo.
