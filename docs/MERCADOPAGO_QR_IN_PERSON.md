# Mercado Pago — Cobros presenciales con QR (Argentina)

Integración con la **Orders API** (`POST /v1/orders`, `type=qr`) para cobros in-person en ARS. El access token **nunca** se expone al frontend: todas las llamadas pasan por rutas server-side en Next.js.

Documentación oficial:

- [Procesamiento de pagos QR](https://www.mercadopago.com.ar/developers/es/docs/qr-code/payment-processing)
- [Referencia — Crear order QR](https://www.mercadopago.com.ar/developers/en/reference/in-person-payments/qr-code/orders/create-order/post)

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MP_ACCESS_TOKEN` | Sí | Access token de la cuenta MP (backend). Alias: `MERCADOPAGO_ACCESS_TOKEN`. |
| `MP_EXTERNAL_POS_ID` | Sí | ID externo del POS/caja creado en MP (ej. `STORE001POS001`). Alias: `MERCADOPAGO_EXTERNAL_POS_ID`. |
| `MP_STORE_ID` | Recomendada | ID de tienda en MP (referencia operativa; el POS ya está vinculado vía `external_pos_id`). |
| `MP_WEBHOOK_SECRET` | Producción | Secreto para validar firma HMAC de webhooks. Alias: `MERCADOPAGO_WEBHOOK_SECRET`. |
| `MP_QR_EXPIRATION_TIME` | No | Duración ISO 8601 (default `PT16M`). |
| `MP_QR_DEFAULT_MODE` | No | `static`, `dynamic` o `hybrid` (default `dynamic`). |

### Ejemplo `.env` (sandbox)

```env
MP_ACCESS_TOKEN="TEST-1234567890123456-111111-abcdefghijklmnopqrstuvwxyz123456789012345678901234567890-123456789"
MP_WEBHOOK_SECRET="your-webhook-secret"
MP_STORE_ID="12345678"
MP_EXTERNAL_POS_ID="STORE001POS001"
MP_QR_DEFAULT_MODE="dynamic"
```

## Endpoints internos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/payments/qr` | Crea order QR. Header `X-Idempotency-Key` (UUID v4). |
| `GET` | `/api/payments/qr/:orderId` | Consulta estado (sync con MP). |
| `POST` | `/api/payments/qr/:orderId/cancel` | Cancela si `status=created`. |
| `POST` | `/api/payments/qr/:orderId/refund` | Reembolso total o `{ "amount": 500 }` parcial. |

Body de creación:

```json
{
  "amount": 1500,
  "description": "Consulta presencial",
  "external_reference": "ref-unica-123",
  "mode": "dynamic",
  "items": [
    { "title": "Consulta", "unit_price": 1500, "quantity": 1, "unit_measure": "unit" }
  ]
}
```

Respuesta incluye `order.mpOrderId`, `order.mpPaymentId` y `order.qrData` (EMVCo) cuando `mode` es `dynamic` o `hybrid`.

## Webhooks

Configurá en [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) la URL:

```
https://www.sanovacapital.com/api/webhooks/mercadopago
```

Eventos de tipo `order` / `merchant_order` actualizan la tabla `MercadoPagoQrOrder` (`status`, `mpPaymentId`).

## UI

`/dashboard/cobrar` incluye el panel **Cobro presencial — Mercado Pago QR** con monto, descripción, selector de modo, generación de QR EMVCo y polling de estado.

## Modos QR

| Modo | Comportamiento |
|------|----------------|
| `static` | El cliente paga escaneando el QR fijo del POS (`MP_EXTERNAL_POS_ID`). |
| `dynamic` | Se renderiza `type_response.qr_data` como QR EMVCo único por cobro. |
| `hybrid` | POS estático + QR dinámico; solo uno puede pagarse. |

## Pasar de prueba a producción

1. **Credenciales**
   - Sandbox: token `TEST-...` desde [Credenciales de prueba](https://www.mercadopago.com.ar/developers/panel/app).
   - Producción: token `APP_USR-...` desde **Credenciales de producción** (activar cuenta comercial).

2. **Tienda y POS**
   - Crear store y caja en MP (panel o API de stores/pos).
   - Usar el mismo `external_pos_id` en `MP_EXTERNAL_POS_ID`.

3. **Webhook**
   - Registrar URL de producción con HTTPS.
   - Copiar el secret generado a `MP_WEBHOOK_SECRET` en Vercel.

4. **Vercel**
   - Actualizar variables en el proyecto `sano-token-web` (Production).
   - Ejecutar migración: `pnpm --filter @sanova/database db:migrate:deploy`.

5. **Validación**
   - Crear cobro de monto bajo en `/dashboard/cobrar`.
   - Pagar con usuario de prueba MP (sandbox) o cuenta real (prod).
   - Verificar `mpOrderId` / `mpPaymentId` en DB y estado vía GET.

## Tests

```bash
pnpm --filter @sanova/web test -- mercadoPagoQr
```

Los tests mockean `fetch` y Prisma; no llaman a la API real de MP.

## Pix (Brasil)

No incluido en este módulo. Pix requiere credenciales BR, POS en reales (BRL) y flujo separado. Consultar documentación BR antes de implementar.
