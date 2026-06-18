# Sanova Global — Web3 Onboarding, Payments & Lending Architecture

> **Stack:** Base L2 · Didit (KYC) · Privy (embedded wallets) · dLocal → Privy On-Ramp · Morpho Blue · Steakhouse vaults

## 1. Identity & compliance layer (Didit — preserved)

Didit remains the **sole KYC / Proof of Humanity** provider. NextAuth handles platform login; Didit runs **after** email + phone verification.

```mermaid
flowchart TD
  A[NextAuth login] --> B[Contact + email OTP]
  B --> C[Phone OTP]
  C --> D{Didit enabled?}
  D -->|yes| E[POST /api/onboarding/didit/session]
  E --> F[Didit hosted KYC]
  F --> G[Webhook + status poll]
  G --> H{KYC approved?}
  H -->|yes| I[Privy embedded wallet step]
  H -->|no| J[Manual review / retry]
  I --> K[Wallet linked to Didit userId]
  K --> L[Marketplace checkout unlocked]
```

**Backend gates:** `kycStatus === APPROVED'` required via `linkUserWallet()` and `requireMorphoBorrowSession()`.

**Files:**
- `apps/web/src/lib/onboarding/diditService.ts`
- `apps/web/src/components/kyc/OnboardingView.tsx`
- `apps/web/src/app/api/onboarding/didit/*`

---

## 2. Privy embedded wallet (post-KYC)

After Didit approval, **Privy is the exclusive wallet provider** for investors (no external wallet required).

```mermaid
sequenceDiagram
  participant U as Investor
  participant OV as OnboardingView
  participant P as Privy SDK
  participant API as /api/investor/wallet
  participant DB as Prisma User

  U->>OV: step=wallet (KYC approved)
  OV->>P: login() + createOnLogin embedded wallet
  P-->>OV: Base address 0x…
  OV->>API: POST { walletAddress, walletProvider: Privy }
  API->>DB: linkUserWallet (KYC gate)
  DB-->>U: operational account
```

**Gas abstraction:** Configure **Privy Dashboard → Gas sponsorship** for Base. Client config sets `createOnLogin: 'users-without-wallets'` and minimizes signature prompts.

**Files:**
- `apps/web/src/lib/privy/config.ts`
- `apps/web/src/components/kyc/PrivyOnboardingWallet.tsx`
- `apps/web/src/hooks/usePrivyEmbeddedWallet.ts`

---

## 3. Payment cascade (dLocal → Privy On-Ramp)

```mermaid
flowchart TD
  subgraph geo [Geo / availability]
    C[User country + DLOCAL_API_KEY]
  end

  C --> D{dLocal operational?}
  D -->|MX IN AR BR…| E[dLocal SPEI / UPI / Pix]
  D -->|other| F[Privy On-Ramp]

  E --> G[dLocal webhook paid]
  G --> H[privyWalletFundingService]
  H --> I[USDC on Base → user embedded wallet]
  I --> J[Vault share delivery / treasury confirm]

  F --> K[useFundWallet USDC Base]
  K --> L[payToTreasury / purchase confirm]
```

| Priority | Rail | User sees | Backend |
|----------|------|-----------|---------|
| 1 | dLocal | Local fiat (SPEI, UPI, Pix) | Webhook → auto USDC credit to Privy wallet |
| 2 | Privy On-Ramp | Card / Apple Pay | Client fund → treasury settlement |

**Policy:** `paymentRoutePolicy.ts`, `privyOnRampPolicy.ts`, `dlocalCountryCoverage.ts`

**Settlement:** `fiatRailTreasurySettlement.ts` + `privyWalletFundingService.ts`

---

## 4. Morpho Blue + Steakhouse vaults

```mermaid
flowchart LR
  subgraph collateral [Collateral]
    VS[ERC-4626 vault shares]
    SH[Steakhouse MetaMorpho vaults]
  end

  subgraph morpho [Morpho Blue Base]
    M[Morpho contract]
    O[Chainlink oracle]
    IRM[AdaptiveCurve IRM]
  end

  VS --> M
  SH --> M
  M --> USDC[USDC borrow]
  USDC --> HF[Health Factor monitor]
```

**Steakhouse:** Curator vault addresses on Base via `STEAKHOUSE_VAULT_ADDRESSES` (comma-separated). Routing prefers Steakhouse MetaMorpho when configured.

**Health factor:** `morphoHealthFactor.ts` — reads borrow/supply shares, LLTV, collateral USD → HF = collateral×LLTV / debt.

**API routes:**
- `GET /api/lending/health-factor`
- `POST /api/lending/borrow-preview`
- `POST /api/lending/prepare`
- `POST /api/marketplace/cart/leveraged-checkout`

---

## 5. Leveraged purchase flow

```mermaid
sequenceDiagram
  participant U as Investor
  participant C as CartCheckoutView
  participant L as LeveragedCheckoutPanel
  participant M as Morpho
  participant T as Treasury

  U->>C: Select "Borrow to buy"
  C->>L: amountUsd + projectId
  L->>M: prepareBorrow (collateral = vault shares)
  M-->>L: tx batch: borrow USDC
  L->>T: payToTreasury / confirm purchase
  T-->>U: RWA shares credited
```

**Single signing path:** Privy embedded wallet executes prepared tx batch via `executePreparedTransactionsWithWalletClient`.

---

## Environment checklist

| Variable | Purpose |
|----------|---------|
| `DIDIT_*` | KYC sessions + webhooks |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Client embedded wallets |
| `PRIVY_APP_SECRET` | Server earn / funding API |
| `PRIVY_VAULT_ID` | Privy Earn vault |
| `DLOCAL_*` | Local rails priority |
| `MORPHO_*` / `METAMORPHO_*` | Lending contracts |
| `STEAKHOUSE_VAULT_ADDRESSES` | Steakhouse curator vaults |
