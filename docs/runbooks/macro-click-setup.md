# Click de Pago (Banco Macro) — Sanova

Sanova holds ARS and USD accounts at Banco Macro. Click de Pago (PlusPagos / Tecnología Macro) covers:

1. **Token purchases** — hosted Botón de Integración (cards, Transfer 3.0, DEBIN) + API DEBIN/QR/links  
2. **Rent collection** — payment links / QR per property → webhook → operating credit → USDC Base → Privy holders  

Macro only settles **fiat** into the Macro bank account. USDC conversion + Privy distribution is Sanova orchestration (`creditAndDistributeOperatingRent` + yield / Ripio rails).

## Environment

| Variable | Purpose |
|----------|---------|
| `MACRO_CLICK_GUID` | Comercio GUID |
| `MACRO_CLICK_FRASE` | Auth phrase for `POST /sesion` → JWT |
| `MACRO_CLICK_SECRET_KEY` | AES-256-CBC + Hash for Botón POST |
| `MACRO_CLICK_ENV` | `SANDBOX` or `PRODUCTION` |
| `MACRO_CLICK_SUCURSAL` | Optional branch id (encrypt empty string if unused) |
| `MACRO_CLICK_FX_ARS` | ARS per USD for token checkout quoting |

Webhook URL (register in Macro dashboard):

`https://www.sanovacapital.com/api/webhooks/macro-click`

## Rent charge (admin)

```http
POST /api/admin/projects/{projectId}/rent-macro-charge
{ "amount": 450000, "currency": "ARS", "periodKey": "2026-07", "tenantEmail": "inquilino@example.com", "mode": "link" }
```

Currency may be `ARS` or `USD`. On `EstadoId=3` (REALIZADA):

- Credits `ProjectOperatingAccount`
- Distributes to RWA holders of that `projectId`
- ARS + USDC-preference holders → conversion batch → treasury USDC → Privy transfer
- USD → immediate FIAT ledger and/or Privy USDC per holder preference

## Token checkout

Catalog rows: `macro_click_ars`, `macro_click_usd`, `macro_click_debin`.  
UI: Payment Gateway → Argentina → Banco Macro → `MacroClickPayButton`.

## Security

- Botón fields encrypted AES-256-CBC (IV || ciphertext, Base64) — PlusPagos compatible  
- Hash: `SHA256(ip*guid*sucursal*montoCents*secretKey)` lowercase hex  
- Production webhooks: IP allowlist from Macro manual (`MACRO_CLICK_SKIP_IP_CHECK=true` only for staging)
