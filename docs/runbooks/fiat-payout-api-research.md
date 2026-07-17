# Phase 3 — Fiat payout API research (follow-up)

Status: **open / non-blocking**. Fiat withdrawals today are admin-mediated (`PlatformWithdrawal` + `AdminWithdrawalsView`). Automated money-out requires a commercial agreement with a provider.

## Candidates

| Provider | Likely payout surface | Notes for Sanova |
|----------|----------------------|------------------|
| **Mercado Pago** | Money Out / payouts API (AR) | Needs MP business account approved for payouts; not available with checkout-only credentials. |
| **Ripio** | Off-ramp / withdrawal APIs | Confirm if partner can push ARS to CVU/alias of end users. |
| **Bridge** | Fiat off-ramp rails | Strong US/EU; AR coverage must be confirmed. |
| **dLocal** | Payouts API | Common LATAM payouts; requires merchant payout KYC. |

## When a payout API is approved

1. Store provider payout destination ids on `LinkedFiatIdentity` (or extend `payoutDetails`).
2. Call the provider inside `confirmPlatformWithdrawal` (or a new `fulfillFiatWithdrawal`) when `method === 'FIAT'`.
3. Keep admin confirm as fallback / manual override.
4. Webhook: mark `CONFIRMED` / `FAILED` + refund ledger like reject path.

## Owner action

Contact each provider's sales/partner desk and ask for **payout / money-out** product access for Argentina (CVU/CBU/alias). Until then, keep the admin flow shipped in Phase 2.
