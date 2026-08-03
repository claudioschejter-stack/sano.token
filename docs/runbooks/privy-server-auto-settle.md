# Privy server auto-settle (crypto checkout)

Goal: when an investor sends USDC on Base to their **canonical Sanova address**, the platform pays the open cart and delivers RWA shares **without any Privy browser login**.

## Required Vercel env

| Variable | Purpose |
|---|---|
| `PRIVY_APP_SECRET` | Privy REST auth |
| `PRIVY_AUTHORIZATION_PRIVATE_KEY` | Dashboard → Wallet infrastructure → Authorization keys (may include `wallet-auth:` prefix) |
| `PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | Key quorum id from the same screen |
| `NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | Same quorum id (client `addSigners` bootstrap) |
| `NEXT_PUBLIC_PRIVY_CUSTOM_AUTH=true` | Silent NextAuth → Privy sync (helps one-time signer grant) |

## One-time Privy Dashboard steps

1. Create an **Authorization key** and save the private key + quorum id into Vercel.
2. Ensure Custom JWT auth JWKS points at `https://www.sanovacapital.com/api/auth/privy-jwks`.
3. Redeploy.

## Runtime flow

1. Checkout shows only the server-linked address (copy/QR) when balance &lt; amount.
2. When balance ≥ amount, UI calls `POST /api/wallet/privy-inbound/settle` (no Privy modal).
3. Cron `watch-crypto-deposits` also runs `autoSettleAllReadyPrivyCarts`.
4. Server: resolve Privy wallet id → `eth_sendTransaction` (sponsored) USDC → treasury → `verifyCartUsdcPayment` → mint/deliver shares.

## Existing wallets

User-owned embedded wallets need the app authorization key added as a signer once. With Custom Auth + `NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID`, `usePrivyServerSignerBootstrap` does this silently when the Sanova session is open (no email modal).

If Pay fails with `PRIVY_AUTHORIZATION_SIGNER_REQUIRED` / Privy 401 “No valid authorization keys…”, the checkout UI:

1. Warms Custom Auth (`/api/auth/privy-token`) and waits for the embedded Privy session
2. Grants the app authorization key via `addSigners`
3. Retries server settle
4. Falls back to client Privy signing (same funded Sanova address only)
5. If the session never hydrates (`PRIVY_SESSION_REQUIRED`), shows a clear message and switches to **Mi wallet** (Coinbase / WalletConnect) — never leaves a raw Privy code under Pagar

New wallets provisioned server-side now attach `additional_signers` with `PRIVY_AUTHORIZATION_KEY_QUORUM_ID` so server settle works without a browser session.

Still set the env vars above so server settle / cron keep working.
