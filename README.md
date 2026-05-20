# Sanova RWA Platform

Monorepo (Turborepo) con portal web Next.js y API NestJS.

## Requisitos

- Node.js 20+
- PostgreSQL en `localhost:5432` (o Docker)
- Redis opcional (`BULL_ENABLED=false` por defecto)

## Arranque local

```bash
cp .env.example .env
# Editar JWT_SECRET (mín. 32 caracteres) y DATABASE_URL si aplica

npm install
npm run infra:up    # Docker: Postgres + Redis
npm run db:push
npm run db:seed
npm run dev:all
```

- **Web:** http://localhost:3000/marketplace  
- **API:** http://localhost:4000/api/v1/health  

Variables clave en `.env`:

| Variable | Valor local |
|----------|-------------|
| `PORT` | `4000` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` |
| `BULL_ENABLED` | `false` (sin Redis) |

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev:all` | API + Web con chequeo de Postgres |
| `npm run typecheck` | TypeScript en todos los workspaces |
| `npm run contracts:test` | Tests Hardhat |

## Wallet / checkout

Configura `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect Cloud) para RainbowKit en el checkout.

## Observabilidad

Opcional: `SENTRY_DSN` o `NEXT_PUBLIC_SENTRY_DSN` activa Sentry vía `instrumentation.ts`.
