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

### Single-wallet invariants (must all hold)

| Invariant | Where | How to verify |
|---|---|---|
| One ethereum embedded wallet per email | Privy | `GET /api/admin/privy-diagnostics?email=…` → `duplicateWallets` empty. Clean up with `POST /api/admin/privy-diagnostics { "action": "archive_duplicates", "email": "…" }` (archives empty forks; refuses funded wallets) |
| Dashboard never mints wallets on login | Privy Dashboard → Embedded wallets → Ethereum → **create on login = off** | diagnostics `appConfig.ethereumCreateOnLogin === 'off'` |
| App key can spend | Wallet record `additional_signers` contains `PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | diagnostics `authorization.quorumIsAdditionalSigner === true` |
| Gas without ETH | Dashboard → Gas sponsorship → **User pays** + **Base / USDC** | wallet with 0 ETH still settles |
| Settle path | Transfer API `POST /v1/wallets/{id}/transfer` | never `eth_sendTransaction` + `sponsor_options` |
| Signature covers exact URL | `buildPrivyAuthorizationSignature` | no query string on signed POSTs |

`create_on_login: "users-without-wallets"` is the duplicate-wallet factory: every Custom Auth login without a wallet gets a **new empty** wallet, which then mismatches the funded one.

## Required Vercel env (Production)

| Variable | Purpose |
|---|---|
| `PRIVY_APP_SECRET` | Privy REST auth |
| `PRIVY_AUTHORIZATION_PRIVATE_KEY` | Dashboard → Wallet infrastructure → Authorization keys (may include `wallet-auth:` prefix) |
| `PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | Key quorum id from the same screen |
| `NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID` | Same quorum id (client `addSigners` bootstrap) |
| `NEXT_PUBLIC_PRIVY_CUSTOM_AUTH=true` | Silent NextAuth → Privy sync |
| `PRIVY_JWT_PRIVATE_KEY` | PKCS8 PEM that matches JWKS kid `sanova-rwa-v2` (store `\n` as literal `\n` in Vercel) |
| `PRIVY_JWT_ISSUER` | Optional; default `https://www.sanovacapital.com` (must match Dashboard if issuer is set there) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app (also used as JWT `aud`) |

If jwt.io shows **Invalid Signature** against `PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM`, the Vercel private key does not match JWKS — rotate both together (new PEM in Vercel + new JWKS deploy).

## Production checklist (Phase 0 — do before / right after deploy)

### Custom JWT auth (fixes `invalid_credentials` / CORS on `auth.privy.io`)

Cloudflare **bot-challenges** `https://www.sanovacapital.com/api/auth/privy-jwks` (HTTP 403 “Just a moment…”). Privy’s servers cannot solve that challenge, so JWT verification fails with `invalid_credentials`. The browser then shows a CORS error on the 401/429 response — the CORS message is a **symptom**, not the root cause.

- [ ] All env vars above set on **Production** (and Preview if testing there)
- [ ] Privy Dashboard → Integrations → Plugins → Custom Auth Support approved
- [ ] Privy Dashboard → User management → Authentication → JWT-based auth enabled
- [ ] **Verification key (pick ONE):**
  - **Preferred:** paste **Public verification key (PEM)** from Admin `GET /api/admin/privy-custom-auth` → `recommendedPublicKeyPem` (or `PRIVY_CUSTOM_AUTH_PUBLIC_KEY_PEM` in code)
  - **Or** JWKS URL = `https://sano-token-web.vercel.app/api/auth/privy-jwks` (**not** `www.sanovacapital.com` / apex — Cloudflare blocks them)
- [ ] User ID claim = `sub`
- [ ] Auth from: **Client-side** or **Both** (required for browser `useSubscribeToJwtAuthWithFlag`)
- [ ] Allowed origins include `https://www.sanovacapital.com`
- [ ] If Dashboard has an issuer field, set it to `https://www.sanovacapital.com` (same as JWT `iss`)
- [ ] Authorization key created; private key + quorum id in Vercel (`PRIVY_AUTHORIZATION_*` + `NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID`)
- [ ] Redeploy after env changes
- [ ] Smoke: Admin `GET /api/admin/privy-custom-auth` → `jwksProbes.vercel.ok === true`, `privateKeyMatchesJwks === true`
- [ ] Smoke: `GET /api/auth/privy-token` as logged-in investor returns `{ token }`
- [ ] Smoke: `POST /api/investor/wallet/provision` returns canonical address
- [ ] **Stuck funded wallets (legacy email-only):** in Privy Dashboard, open the funded address (e.g. `0x840a…`) and add the app authorization key / key quorum as **additional signer** once. Without this, server settle returns 401 “No valid authorization keys…” even when Custom Auth works for a *different* empty wallet.
- [ ] Privy Dashboard → Wallet infrastructure → **Gas sponsorship** → mode **User pays** + **Base / USDC** (not App pays). Checkout settles via **Transfer API** (`POST /v1/wallets/{id}/transfer`) — User pays does **not** work on `eth_sendTransaction` / `sponsor_options` (Privy returns `400 invalid_data`).
- [ ] Cart with Sanova balance ≥ **investment + live gas quote** → **Pagar** settles to `CONFIRMED` and credits RWA tokens
- [ ] Crypto checkout total shows live Base gas in USDC (not the old $0.001 fixed estimate)
- [ ] Confirm UI does **not** auto-switch to **Mi wallet** when Sanova balance is sufficient

### Cloudflare (optional hardening)

Add a WAF / Configuration Rule: skip Bot Fight / Managed Challenge for URI Path equals `/api/auth/privy-jwks` (and ideally `/api/auth/privy-token` is same-origin only — leave it alone). Until then, keep Privy on the Vercel JWKS URL or PEM.

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

**Single-wallet policy:** one email → one ethereum embedded wallet. `ensureSanovaPrivyWallet` must never create a Custom Auth user/wallet when the email Privy user already has a wallet.

New greenfield wallets attach `additional_signers` automatically.

Older email-provisioned wallets need a **one-time** authorization-key grant (Dashboard on the **funded** wallet, or checkout **Autorizar wallet Sanova fondeada** email OTP → `addSigners`). Until then, USDC is visible but unspendable by the server.

`addSigners` only works after Custom Auth succeeds **and** the Privy session user owns the funded address. If Custom Auth created a second empty wallet, grant the signer on the **funded** address in the Dashboard — do not look for an “Additional signers” toggle on Authorization keys; open the **wallet** record instead.

## Troubleshooting: console `invalid_credentials` + CORS

| Symptom | Meaning | Fix |
|---|---|---|
| `POST …/custom_jwt_account/authenticate` 401 `invalid_credentials` | Privy cannot verify our JWT (usually JWKS fetch failed) | PEM or Vercel JWKS URL in Dashboard |
| CORS error on that same request | Browser hiding the 401/429 body | Fix verification; ignore CORS as primary |
| 429 Too Many Requests | Retry storm after failed auth | Wait ~1 min; fix Dashboard; client now cools down 60s |
| `PRIVY_AUTHORIZATION_SIGNER_REQUIRED` with funded Sanova | Wallet has USDC but no app signer | Dashboard additional signer on that address |
| Tokens missing / supply looks wrong | DB booked vs on-chain vault shares drifted | `GET /api/admin/token-reconciliation?email=…` (investor holdings + project supply) and `&movements=1` for the on-chain vault share movement log. `issues: []` means everything reconciles. |
| Several open 20 USDC carts for one purchase | Each failed attempt left its batch in `REQUIRES_PAYMENT` | Settle now expires siblings before creating a batch and after settling. Manual: `POST /api/admin/crypto-reconcile { email, action: "close_stale" }` (add `batchId` to keep one). |
| Investor debited but cart still open | Transfer landed on-chain after the settle response window | `GET /api/admin/crypto-reconcile?email=…` lists treasury payments from their wallet; `POST` with `{ email, txHash }` (or `{ email }` for auto-match) confirms the batch, credits tokens and decrements supply. Settle also self-reconciles now before reporting failure. |
| `PRIVY_TRANSFER_FAILED` | Transfer API rejected settle | Read the `detail` in the checkout message / server log. `zero_correct_authorization_signatures` → signature URL/body mismatch. Insufficient gas → Dashboard gas is not **User pays + Base/USDC**. |
| `Duplicate signer(s) provided when updating wallet` (PATCH 400) | Quorum already an additional signer | Benign — client `addSigners` treats it as success |
| `PRIVY_WALLET_ADDRESS_MISMATCH` | Custom Auth session wallet ≠ funded legacy email wallet | In checkout use **Autorizar wallet Sanova fondeada** (email OTP → `addSigners` on funded address), then **Pagar** again. Prevent forks: `ensureSanovaPrivyWallet` must never create a second wallet for the same email. Admin: `POST /api/admin/account-audit` with `{ "action": "pin_original", "userId": "…" }` pins DB to the original email wallet and lists duplicates (delete empty forks in Privy Dashboard). |
