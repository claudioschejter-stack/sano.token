# Click de Pago (Banco Macro) — Sanova

Sanova holds ARS and USD accounts at Banco Macro. Click de Pago (PlusPagos / Tecnología Macro) covers:

1. **Token purchases** — hosted Botón de Integración (cards, Transfer 3.0, DEBIN) + API DEBIN/QR/links  
2. **Rent collection** — payment links / QR per property → webhook → operating credit → USDC Base → Privy holders  
3. **Botón Simple** (optional) — Código de Ente + debt-search URL for simple collection UX  

Macro only settles **fiat** into the Macro bank account. USDC conversion + Privy distribution is Sanova orchestration (`creditAndDistributeOperatingRent` + yield / Ripio rails).

## Environment

| Variable | Purpose |
|----------|---------|
| `MACRO_CLICK_GUID` | Identificador de comercio (GUID) |
| `MACRO_CLICK_FRASE` | Auth phrase for `POST /sesion` → JWT |
| `MACRO_CLICK_SECRET_KEY` | AES-256-CBC + Hash for Botón POST |
| `MACRO_CLICK_ENV` | `SANDBOX` or `PRODUCTION` |
| `MACRO_CLICK_SUCURSAL` | Optional branch id (encrypt empty string if unused) |
| `MACRO_CLICK_FX_ARS` | ARS per USD for token checkout quoting |
| `MACRO_CLICK_ENTE_CODE` | Código de Ente (Botón Simple), e.g. sandbox `795347` |
| `MACRO_CLICK_DEBT_SEARCH_URL` | Optional override for Botón Simple debt URL |
| `MACRO_CLICK_SKIP_IP_CHECK` | `true` on sandbox/staging so webhooks are not IP-blocked |

Webhook URL (register in Macro dashboard):

`https://www.sanovacapital.com/api/webhooks/macro-click`

For local/preview testing, also register the preview URL if Macro allows multiple endpoints.

## Sandbox credentials (SANOVA GLOBAL SAS)

Macro issued sandbox values for **SANOVA GLOBAL SAS**. Map them as:

| Macro field | Env var |
|-------------|---------|
| URL POST | `MACRO_CLICK_CHECKOUT_URL=https://sandboxpp.asjservicios.com.ar` (or leave default with `MACRO_CLICK_ENV=SANDBOX`) |
| Identificador de comercio | `MACRO_CLICK_GUID` |
| SECRET-KEY | `MACRO_CLICK_SECRET_KEY` |
| FRASE | `MACRO_CLICK_FRASE` |
| Código de Ente (Botón Simple) | `MACRO_CLICK_ENTE_CODE=795347` |
| URL búsqueda de deuda | `MACRO_CLICK_DEBT_SEARCH_URL=https://sandboxpp.asjservicios.com.ar:8110/795347` |

Also set:

```bash
MACRO_CLICK_ENV=SANDBOX
MACRO_CLICK_SKIP_IP_CHECK=true
```

**Do not commit secrets.** Add them in Vercel → Project → Settings → Environment Variables for **Preview** and **Development** (and Production only when Macro promotes live credentials).

### Verify sandbox

```bash
# with env loaded
npx tsx scripts/ops/verify-macro-click-sandbox.ts
```

Expected: `health.status=true` and `session ok` (JWT). The sandbox `/sesion` response returns the JWT in `data` as a **string** (handled by `extractMacroClickSessionToken`).

API base (default sandbox): `https://sandboxpp.asjservicios.com.ar:8082/v1`  
Checkout POST (Botón Integración): `https://sandboxpp.asjservicios.com.ar/`

Macro support: `recaudacionesmda@macro.com.ar` · 0810 555 2112

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
