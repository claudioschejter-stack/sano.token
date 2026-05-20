# Sanova Global Stress Test Local

Este flujo valida de extremo a extremo: contratos locales, `BlockchainListenerService`, Prisma, distribución cash y cálculo de LTV.

## 1. Terminal A - Nodo local Hardhat

```bash
npm run compile -w @sanova/contracts
npx hardhat node
```

Deja esta terminal abierta. El nodo expone RPC en:

```bash
http://127.0.0.1:8545
```

## 2. Terminal B - Base de datos y API NestJS

Configura las variables mínimas del backend:

```bash
set NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
set BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
set ASSET_TOKEN_DECIMALS=18
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sanova_rwa?schema=public
set JWT_SECRET=change-this-local-secret-with-32-chars
```

Sincroniza Prisma y levanta la API:

```bash
npm run db:push -w @sanova/database
npm run api:dev
```

Cuando el script de stress imprima la dirección del token, vuelve a exportarla en esta terminal y reinicia la API para que el listener tome el contrato:

```bash
set ERC3643_TOKEN_ADDRESSES=0xTOKEN_DESPLEGADO
npm run api:dev
```

En logs deberías ver:

```bash
Listening to 1 ERC-3643 asset token(s).
Blockchain listener connected and synchronized.
```

## 3. Terminal C - Stress test on-chain

Con el nodo Hardhat activo:

```bash
npm run stress:test -w @sanova/contracts
```

El script:

- Despliega `SanovaAssetToken` si no existe `SANOVA_ASSET_TOKEN_ADDRESS`.
- Crea 10 wallets institucionales desde cuentas Hardhat.
- Ejecuta KYC con `setKyc`.
- Mintea tenencias ponderadas de Tolhuin.
- Ejecuta 50 transferencias consecutivas confirmadas.

Al final imprime:

```bash
Configure backend ERC3643_TOKEN_ADDRESSES=0xTOKEN_DESPLEGADO
```

## 4. Disparar distribución cash manual

Con la API corriendo:

```bash
curl -X POST http://localhost:3001/api/v1/test/trigger-monthly-yield ^
  -H "Content-Type: application/json" ^
  -d "{\"assetId\":\"Tolhuin\",\"amount\":100000}"
```

En logs de NestJS deberías ver:

```bash
Dividend distribution completed assetId=Tolhuin ... totalCash=100000.000000 distributed=100000.000000
Dividend allocation assetId=Tolhuin userId=... ownership=... amountUsd=...
```

## 5. Validaciones esperadas

- El listener debe registrar transfers sin errores RPC.
- Prisma debe reflejar cambios de `Investment`, `Investor.totalCapital` e `Investor.ltv`.
- `DividendDistribution` debe crear registros con `status = LIQUIDATED_CASH`.
- El total distribuido debe coincidir exactamente con el monto del trigger, sin diferencias decimales.

## Comandos de verificación

```bash
npm run typecheck -w @sanova/contracts
npm run typecheck -w @sanova/api
npm run build -w @sanova/api
```
