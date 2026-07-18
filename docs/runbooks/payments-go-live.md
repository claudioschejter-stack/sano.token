# Payments go-live (treasury-first)

**Definition of done:** investor can pay → USDC lands in Sanova Base treasury → purchase/deposit confirms.  
**Not in scope yet:** auto-credit USDC/tokens into the investor Privy wallet after fiat.

## Production readiness (automated)

```bash
# From repo root
node scripts/vercel/smoke-payments-health.mjs
# or
SMOKE_BASE_URL=https://sanovacapital.com node scripts/vercel/smoke-payments-health.mjs

npm run vercel:verify-payments   # reads Vercel Production env (may differ from .env.local)
```

Expected health: `productionReady: true`, gateways `mercadoPago`, `ripio`, `bridge`, `usdcOnchain`.

Admin: `GET /api/admin/payments/status` (authenticated).

## Env (Vercel Production)

| Group | Keys | Status target |
|-------|------|---------------|
| Treasury | `BASE_STABLECOIN_TREASURY_ADDRESS`, `BASE_USDC_TOKEN_ADDRESS`, `BASE_RPC_URL`, `CRON_SECRET` | Required |
| Bridge VA | `BRIDGE_API_KEY`, `BRIDGE_WEBHOOK_PUBLIC_KEY`; keep `BRIDGE_ALLOW_SIMULATED_VA` unset/`false` | Required for non-AR wire |
| MP | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Required for AR |
| Ripio | `RIPIO_CLIENT_ID`, `RIPIO_CLIENT_SECRET`, `RIPIO_WEBHOOK_SECRET`, `RIPIO_ENV=PRODUCTION`, `RIPIO_CHAIN=BASE`, `RIPIO_FX_ARS` | Required for AR→USDC |
| Privy | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | Required for embedded wallet / USDC pay |
| Bridge payouts | `BRIDGE_PAYOUTS_ENABLED` + `BRIDGE_WALLET_ID` | **Off** until wallet funded |

## Webhooks

| Provider | URL | Check |
|----------|-----|--------|
| Bridge | `https://www.sanovacapital.com/api/webhooks/bridge` | `cd apps/web && node scripts/bridge-setup.mjs check` → status `active` |
| Mercado Pago | `https://sanovacapital.com/api/webhooks/mercadopago` | MP dashboard notifications |
| Ripio | `https://sanovacapital.com/api/webhooks/ripio` | Ripio Skala webhook for `ON-RAMP.WITHDRAWAL.COMPLETED` |

## Crons

In [`apps/web/vercel.json`](../../apps/web/vercel.json) (Vercel **Hobby** allows only **once/day** per job):

- `/api/cron/watch-crypto-deposits` — `0 11 * * *` (11:00 UTC)  
- `/api/cron/watch-awaiting-treasury-usdc` — `0 13 * * *` (13:00 UTC)  

Requires `CRON_SECRET` / Vercel cron auth. For near-real-time settle after MP/Ripio, use webhooks (primary) or upgrade to Pro and tighten the cron schedule.

## Operator smoke tests (live money)

### A) Bridge (non-AR)

1. Investor with country US/EU/MX/BR/GB (not AR).  
2. Checkout → bank transfer / Bridge → instructions must **not** say simulated.  
3. Complete Bridge KYC + ToS if prompted.  
4. Send small ACH/wire/SEPA/SPEI/Pix to the VA.  
5. Confirm webhook delivery in Bridge dashboard and Sanova deposit/cart credit.

### B) Argentina (MP → Ripio)

1. AR investor pays with Mercado Pago / digital wallet.  
2. Expect interim `MANUAL_REVIEW` / `awaitingTreasuryUsdc`.  
3. Ripio conversion should enqueue → USDC to Base treasury.  
4. Ripio webhook with `txnHash` → status `CONFIRMED`.  
5. If Ripio fails: send USDC manually to treasury (`treasury_ops`) and wait for cron/reconcile.

### C) Privy / USDC

1. KYC Sanova approved + Privy wallet linked.  
2. Fund or hold USDC on Base in the embedded wallet.  
3. Pay purchase to treasury on-chain → confirmation.

### D) Withdrawals

- AR fiat: Admin → Withdrawals → manual bank confirm.  
- Bridge bank payout: keep disabled until `BRIDGE_WALLET_ID` is funded and `BRIDGE_PAYOUTS_ENABLED=true`.

## Architecture reminder

Fiat rails do **not** auto-fund the investor Privy wallet. Settlement is treasury-first; see `privyWalletFundingService.ts` (metadata only until server-side transfer is built).
