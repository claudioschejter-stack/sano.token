# Privy server auto-settle (crypto checkout)

Goal: when an investor has USDC on Base in their **canonical Sanova embedded wallet**, tapping **Pagar** spends that USDC and delivers RWA shares — **without** Coinbase / WalletConnect and **without** a second Privy email login.

## Identity model (Phase 1)

| Layer | Key | Notes |
|---|---|---|
| Sanova user | `User.id` | NextAuth session |
| Privy Custom Auth | `custom_user_id = User.id` | Same `sub` from `/api/auth/privy-token` |
| Receive wallet | Embedded ethereum wallet on that Privy user | Created with `additional_signers` = authorization key quorum |
| Legacy | Email-only Privy users | May still hold funded wallets; keep as receive target until signer is granted |

Server provision: `ensureSanovaPrivyWallet({ userId, email })`  
Client must **not** create a second wallet (`createOnLogin: 'off'`).

## Required Vercel env (Production)

| Variable | Purpose |
|---|---|
| `PRIVY_APP_SECRET` | Privy REST auth |
| `PRIVY_AUTHORIZATION_PRIVATE_KEY` | Dashboard → Wallet infrastructure → Authorization keys (may include `wallet-auth:` prefix) |
| `PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | Key quorum id from the same screen |
| `NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | Same quorum id (client `addSigners` bootstrap) |
| `NEXT_PUBLIC_PRIVY_CUSTOM_AUTH=true` | Silent NextAuth → Privy sync |
| `PRIVY_JWT_PRIVATE_KEY` | Signs `/api/auth/privy-token` JWTs |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app |

## Production checklist (Phase 0 — do before / right after deploy)

- [ ] All env vars above set on **Production** (and Preview if testing there)
- [ ] Privy Dashboard → Custom JWT auth enabled
- [ ] JWKS URL = `https://www.sanovacapital.com/api/auth/privy-jwks`
- [ ] User ID claim = `sub`
- [ ] Authorization key created; private key + quorum id in Vercel
- [ ] Redeploy after env changes
- [ ] Smoke: `GET /api/auth/privy-token` as logged-in investor returns `{ token }`
- [ ] Smoke: `POST /api/investor/wallet/provision` returns canonical address
- [ ] **Stuck funded wallets (legacy email-only):** in Privy Dashboard, add the app authorization key as **additional signer** on the funded Sanova address (required once per old wallet). Without this, server settle returns 401 “No valid authorization keys…”
- [ ] Cart with Sanova balance ≥ amount → **Pagar** settles to `CONFIRMED` and credits RWA tokens
- [ ] Confirm UI does **not** auto-switch to **Mi wallet** when Sanova balance is sufficient

## Runtime flow (Phase 2)

1. Checkout shows server-linked Sanova address (copy/QR) when balance &lt; amount.
2. When balance ≥ amount, **Pagar** runs:
   - `POST /api/investor/wallet/provision` (ensure Custom Auth identity)
   - `POST /api/marketplace/cart/pay-sanova` (server settle with authorization signature)
   - If signer missing: warm Custom Auth → `addSigners` → retry server → client sign **only** if address matches Sanova
3. If signing still fails **but Sanova is funded**: stay on Wallet Sanova, show retry message — **never** force Mi wallet.
4. Mi wallet (Coinbase / WalletConnect) only when Sanova balance is insufficient.
5. Cron `watch-crypto-deposits` also runs `autoSettleAllReadyPrivyCarts`.

## Existing / legacy wallets

New wallets created via `ensureSanovaPrivyWallet` attach `additional_signers` automatically.

Older email-provisioned wallets need a **one-time** authorization-key grant (Dashboard or successful Custom Auth `addSigners` once the browser session owns that same wallet). Until then, USDC is visible but unspendable by the server.
