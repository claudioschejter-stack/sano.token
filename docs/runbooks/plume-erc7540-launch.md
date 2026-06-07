# Plume Network + ERC-7540 vault launch

## Objetivo

Emitir tokens RWA como vault **ERC-4626** (sync) o **ERC-7540** (async) y registrarlos como colateral en **Morpho** y **Centrifuge**, con soporte de red **Plume** (chain ID `98866` mainnet / `98867` testnet).

## Estado en la plataforma

| Capacidad | Base (8453) | Plume (98866) |
|-----------|-------------|---------------|
| ERC-4626 (`SanovaRwaVault`) | ✅ | ✅ |
| ERC-7540 (`SanovaAsyncVault`) | ✅ | ✅ (recomendado) |
| Morpho market auto-create | ✅ | ✅ (requiere `PLUME_USDC_TOKEN_ADDRESS`) |
| Centrifuge API propose | ✅ | ✅ |
| Wallet wagmi Plume | Con `NEXT_PUBLIC_PLUME_ENABLED=true` | |

## Variables de entorno (producción Plume)

```env
TOKEN_DEPLOY_CHAIN_ID=98866
MORPHO_CHAIN_ID=98866
LENDING_CHAIN_ID=98866
PLUME_RPC_URL=https://rpc.plume.org
NEXT_PUBLIC_PLUME_ENABLED=true
NEXT_PUBLIC_PLUME_RPC_URL=https://rpc.plume.org
PLUME_USDC_TOKEN_ADDRESS=<USDC en Plume>
MORPHO_PLUME_ADDRESS=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
CENTRIFUGE_API_KEY=<tu key>
CENTRIFUGE_POOL_ADMIN_URL=<hub admin url>
TOKEN_DEPLOY_PRIVATE_KEY=<wallet con PLUME para gas>
TOKEN_TREASURY_ADDRESS=<Safe treasury>
```

## Flujo admin

1. Admin → Lanzamiento → estándar **ERC-7540** (async) o **ERC-4626** (sync).
2. Activar colateral **Morpho** + **Centrifuge** en el checklist.
3. Guardar/publicar: pipeline automático despliega `SanovaAssetToken` + vault + fondo treasury + mercado Morpho.
4. `POST /api/admin/assets/{id}/register-collateral` envía paquete a Centrifuge Hub.

## ERC-7540 vs ERC-4626

- **ERC-4626**: depósito/retiro síncrono; ideal para Morpho borrow inmediato en Base.
- **ERC-7540**: `requestDeposit` → `fulfillDepositRequest` (owner) → `claimDeposit`; alinea con Centrifuge v3 y settlement RWA en Plume.

Tras el bootstrap, el treasury puede desactivar depósitos síncronos:

```solidity
setSynchronousDepositEnabled(false)
```

## Manual (credenciales)

- Fondear wallet deploy con **PLUME** en Plume mainnet.
- Configurar `PLUME_USDC_TOKEN_ADDRESS` (Morpho loan asset).
- Verificar contratos en https://explorer.plume.org si aplica.
- Centrifuge: completar checklist legal + API key en Settings → DeFi Integrations.

## Referencias

- Plume: https://docs.plume.org/plume/developers/network-information
- Morpho addresses: https://docs.morpho.org/get-started/resources/addresses/
- Centrifuge: https://docs.centrifuge.io
