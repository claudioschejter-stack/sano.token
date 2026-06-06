# Presupuesto JS por ruta (First Load)

Objetivos para builds de producción (`npm run analyze -w @sanova/web`).

| Ruta | First Load JS (objetivo) | Notas |
|------|--------------------------|-------|
| `/` (marketing) | < 200 KB | Sin Web3 providers |
| `/marketplace` | < 250 KB | Feed SSR + hidratación ligera |
| `/marketplace/[id]/checkout` | < 400 KB | Web3 scoped (RainbowKit) |
| `/dashboard` | < 300 KB | Portal sin checkout wallet |
| `/mercado-secundario` | < 350 KB | Charts + feed |

## Cómo medir

```bash
npm run analyze -w @sanova/web
```

Abre el reporte HTML del bundle analyzer en el navegador.

## Regresión

Si una ruta supera el presupuesto:

1. Verificar que Web3 no esté en layout raíz (solo portal/checkout/KYC)
2. Dynamic import para charts y componentes pesados
3. Revisar duplicados `viem` / `ethers` / `wagmi` en el chunk
