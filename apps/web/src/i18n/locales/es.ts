import type { Messages } from './en';

export const es = {
  brand: {
    portalSubtitle: 'Portal RWA'
  },
  common: {
    buyNow: 'Comprar Ahora',
    investNow: 'Invertir ahora',
    reserveTokens: 'Reservar tokens',
    completeKyc: 'Completar KYC',
    projectedApy: 'APY Proyectado',
    location: 'Ubicación',
    backToMarketplace: 'Volver al marketplace'
  },
  propertyCard: {
    kycRequired: 'Se requiere verificación de identidad antes de la compra.',
    readyForCheckout: 'Estás verificado. Continúa al checkout Web3.',
    placementProgress: 'Progreso de colocación',
    tokenPrice: 'Precio / token',
    estimatedAnnualIncome: 'Renta anual estimada',
    perToken: 'token',
    instantLiquidity: 'Salida instantánea vía tesorería (−3% SanovaAMM)',
    limitedAvailability: 'Alta demanda',
    viewMap: 'Ver en mapa'
  },
  marketplace: {
    title: 'Marketplace RWA',
    subtitle: 'Activos reales tokenizados con liquidez inmediata y tasas de préstamo competitivas.',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: 'Mejor tasa de endeudamiento',
    tokensAvailable: 'tokens disponibles',
    loading: 'Cargando oportunidades…',
    empty: 'No hay listados activos por el momento.',
    error: 'No se pudieron cargar datos en vivo. Mostrando listados demo.',
    lendingBanner: 'Agregado desde Aave, Compound y Maker',
    syncing: 'Sincronizando datos en vivo…',
    trustKyc: 'Inversores con KYC',
    trustRegulation: 'Régimen fiscal informado',
    trustOnchain: 'Liquidación on-chain'
  },
  nav: {
    language: 'Idioma',
    dashboard: 'Dashboard',
    marketplace: 'Marketplace',
    myAssets: 'Mis Activos',
    cashFlow: 'Flujo de Caja',
    signOut: 'Cerrar Sesión'
  },
  checkout: {
    notFound: 'Proyecto no encontrado.',
    title: 'Checkout',
    kycReady: 'KYC aprobado · listo para firmar on-chain',
    tokenQuantity: 'Cantidad de tokens',
    lessTokens: 'Menos tokens',
    moreTokens: 'Más tokens',
    maxAvailable: 'Máx. {count} disponibles',
    pricePerToken: 'Precio por token',
    subtotal: 'Subtotal ({count} tokens)',
    total: 'Total ({currency})',
    requestSent: 'Solicitud enviada — revisa tu wallet',
    signing: 'Firmando transacción…',
    confirmPurchase: 'Confirmar compra on-chain',
    connectToContinue: 'Conecta tu wallet para continuar'
  },
  wallet: {
    disconnect: 'Desconectar',
    connecting: 'Conectando…',
    connect: 'Conectar wallet (MetaMask / injected)',
    noWallet: 'Instala MetaMask u otra wallet compatible con el navegador.'
  },
  dashboard: {
    eyebrow: 'Capital y Cobertura',
    title: 'Sanova Global SAS — Analítica de Portfolio',
    subtitle:
      'Seguimiento institucional del flujo de caja líquido, cobertura de deuda y rendimiento de activos físicos tokenizados.',
    kpiDividends: 'Dividendos en Efectivo Recibidos (USDC)',
    kpiDividendsHint: 'Acumulado liquidado vía listener on-chain',
    kpiDebtCoverage: 'Cobertura de Deuda Activa',
    kpiDebtCoverageHint: '% de amortización cubierto contra pasivo vigente',
    kpiAneloYield: 'Rendimiento Operaciones Añelo',
    kpiAneloYieldHint: 'Yield proyectado sobre NAV del activo físico',
    chartTitle: 'Flujo mensual: dividendos vs. servicio de deuda',
    chartSubtitle: 'Cruce de ingresos por dividendos liquidados frente al servicio de deuda programado.',
    chartCurrency: 'USDC / USD — vista consolidada',
    chartDividends: 'Ingresos por dividendos',
    chartDebt: 'Servicio de deuda',
    distributionsTitle: 'Últimas Distribuciones Liquidadas',
    distributionsSubtitle: 'Eventos indexados por el listener blockchain — tramo cash en USDC.',
    colDate: 'Fecha',
    colAsset: 'Activo',
    colConcept: 'Concepto',
    colAmount: 'Monto USDC',
    colStatus: 'Estado',
    colTx: 'Tx',
    syncing: 'Sincronizando distribuciones…',
    empty: 'No hay distribuciones liquidadas registradas.',
    liveDividend: 'Dividendo en vivo recibido'
  },
  chart: {
    unavailable: 'Gráfico no disponible',
    unavailableHint: 'El resto del dashboard sigue operativo. Reintenta recargando la página.'
  },
  error: {
    eyebrow: 'Algo salió mal',
    title: 'No pudimos cargar esta vista',
    fallback: 'Error temporal del portal. Puedes volver al marketplace o reintentar.',
    retry: 'Reintentar',
    goMarketplace: 'Ir al marketplace',
    globalTitle: 'Error inesperado',
    globalHint: 'Ocurrió un fallo en la aplicación. Tu sesión y datos están protegidos.'
  }
} satisfies Messages;
