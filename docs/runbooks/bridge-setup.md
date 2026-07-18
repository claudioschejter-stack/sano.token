# Bridge.xyz setup (Sanova)

Settlement: **local fiat VA → USDC on Base → Sanova treasury**.

Supported Bridge Virtual Account source currencies:

| Country | Source | Rails |
|---------|--------|-------|
| US / CA / AU | `usd` | ACH push, wire |
| EU | `eur` | SEPA |
| MX | `mxn` | SPEI |
| BR | `brl` | Pix |
| GB | `gbp` | Faster Payments |

Investor flow: **KYC link (Persona) + ToS → Virtual Account → deposit → webhook → USDC Base**.

Argentina keeps **Mercado Pago + Ripio + Privy USDC** (Bridge excluded for `AR`).

## 1. Environment (Vercel)

| Variable | Purpose |
|----------|---------|
| `BRIDGE_API_KEY` | Customers + Virtual Accounts API |
| `BRIDGE_WEBHOOK_PUBLIC_KEY` | RSA public key for `X-Webhook-Signature` (`t=,v0=`) |
| `BRIDGE_WEBHOOK_SECRET` | Legacy HMAC only (tests); not used by Bridge dashboard |
| `BASE_STABLECOIN_TREASURY_ADDRESS` / `TREASURY_WALLET_ADDRESS` | VA destination |
| `BRIDGE_ALLOW_SIMULATED_VA` | Must stay unset/`false` in production |

## 2. Register webhook

```bash
cd apps/web
node scripts/bridge-setup.mjs check
node scripts/bridge-setup.mjs ensure-webhook https://sanovacapital.com/api/webhooks/bridge
```

Copy the printed `PUBLIC_KEY_PEM` into Vercel as `BRIDGE_WEBHOOK_PUBLIC_KEY` (Production + Preview), then redeploy.

Webhook endpoint: `POST /api/webhooks/bridge`  
Event categories: `customer`, `kyc_link`, `transfer`, `virtual_account`.

## 3. Smoke test

1. Admin → payment integrations: Bridge should show configured (API key + public key).
2. Login as investor (US geo or force country `US`).
3. Checkout → wire / Bridge → bank details must **not** say “simulated”.
4. Send a small ACH/wire to the VA (sandbox if Bridge provides it).
5. Confirm webhook delivery in Bridge dashboard and Sanova deposit credit / USDC treasury.

```bash
node scripts/bridge-setup.mjs check
```

## 4. Architecture reminder

| Rail | Provider |
|------|----------|
| Crypto wallets | Privy / on-chain USDC Base |
| Fiat wallets AR | Mercado Pago, Ripio |
| Cards | Transak / Privy on-ramp |
| Bank transfer US/EU | Bridge Virtual Account |
| Withdrawals | Admin-mediated until payout API approved |

See also: [fiat-payout-api-research.md](./fiat-payout-api-research.md).
