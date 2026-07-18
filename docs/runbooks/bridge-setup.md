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
node scripts/bridge-setup.mjs ensure-webhook https://www.sanovacapital.com/api/webhooks/bridge
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

## 4. External accounts (investor bank payout destinations)

Investors can link USD (`us` / ACH), EUR (`iban`), or MXN (`clabe`) bank accounts via Bridge External Accounts.

| Surface | Path |
|---------|------|
| API | `GET/POST /api/wallet/bridge-external-accounts` |
| UI | Security → My wallets → “Link a bank account” |
| Withdraw | Wallet → Fiat → chip selects `bridgeExternalAccountId` |
| Admin | Withdrawals queue shows Bridge EA id + currency |

Requires Bridge KYC + ToS (same customer as Virtual Accounts). Linked rows are stored as `LinkedFiatIdentity` with `provider: bridge`.

## 5. Fiat offramp transfers (wallet → bank)

Admin can create a Bridge transfer from a prefunded Bridge wallet to the investor’s external account:

`POST /v0/transfers` — source `bridge_wallet` + `usdb`/`usdc` → destination `ach` / `sepa` / `spei` + `external_account_id`.

| Env | Purpose |
|-----|---------|
| `BRIDGE_PAYOUTS_ENABLED=true` | Master switch (keep `false` until wallet is funded) |
| `BRIDGE_WALLET_ID` | Prefunded Bridge wallet id |
| `BRIDGE_WALLET_CURRENCY` | `usdb` (default) or `usdc` |
| `BRIDGE_PAYOUT_DEVELOPER_FEE` | Optional absolute fee (e.g. `0.5`) |

Admin UI: Withdrawals → Confirm on a Bridge EA row → **Pay via Bridge** (or paste a manual bank reference).

Idempotency key: `bridge-payout:{withdrawalId}`. Transfer id is stored as `txHash` / metadata.

**Prerequisite:** the Bridge customer (`sanova-{userId}`) must own the external account, and the wallet must be valid for that `on_behalf_of` customer per Bridge’s wallet model. Keep ARS (CBU/alias) manual.

## 6. Architecture reminder

| Rail | Provider |
|------|----------|
| Crypto wallets | Privy / on-chain USDC Base |
| Fiat wallets AR | Mercado Pago, Ripio |
| Cards | Transak / Privy on-ramp |
| Bank transfer US/EU/MX/BR/GB | Bridge Virtual Account (on-ramp) |
| Bank payout US/EU/MX | Bridge External Account + Transfer (admin “Pay via Bridge”) |
| Withdrawals AR | Admin-mediated bank/digital wallet |

See also: [fiat-payout-api-research.md](./fiat-payout-api-research.md).
