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
    home: 'Inicio',
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
  landing: {
    nav: {
      howItWorks: 'Cómo funciona',
      properties: 'Propiedades',
      marketplace: 'Marketplace',
      platformAccess: 'Acceso a Plataforma'
    },
    languageLabel: 'Idioma',
    hero: {
      eyebrow: 'Real estate tokenizado',
      title: 'Poseé activos reales en Vaca Muerta.\nCobrá rentas on-chain.',
      subtitle:
        'Vaca Muerta es el epicentro global del shale oil & gas no convencional, con la segunda reserva de gas del planeta, infraestructura de clase mundial, costos operativos muy competitivos y un enorme potencial de producción petrolera y gasífera. Sanova Global conecta inversores verificados con propiedades productivas en Vaca Muerta, Argentina. Otorgando rendimientos transparentes y muy rentables, con cumplimiento KYC y liquidación instantánea.',
      ctaPrimary: 'Ver propiedades',
      ctaSecondary: 'Cómo funciona',
      trustLine: 'Marcos regulatorios · KYC/AML · Distribuciones on-chain en USDC'
    },
    stats: {
      properties: 'Ofertas activas',
      investors: 'Inversores verificados',
      distributed: 'USDC distribuidos',
      avgApy: 'APY proyectado prom.'
    },
    operators: {
      title: 'Operan actualmente en Vaca Muerta'
    },
    howItWorks: {
      title: 'Invertí en tres pasos',
      subtitle: 'Del descubrimiento a la titularidad on-chain — para inversores retail e institucionales.',
      step1Title: 'Completá KYC',
      step1Desc: 'Verificá tu identidad una vez. Sanova integra proveedores de onboarding regulados.',
      step2Title: 'Elegí una propiedad',
      step2Desc: 'Explorá activos tokenizados con régimen fiscal, APY y avance de colocación informados.',
      step3Title: 'Recibí distribuciones',
      step3Desc: 'Los ingresos por alquiler llegan a tu wallet en USDC. Seguimiento en el portal inversor.'
    },
    featured: {
      title: 'Propiedades destacadas',
      subtitle: 'Activos del mundo real con economía de tokens transparente.',
      viewAll: 'Ver todos los listados',
      soldPercent: '{percent}% colocado',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Por qué Sanova RWA',
      incomeTitle: 'Ingresos recurrentes',
      incomeDesc: 'Distribuciones mensuales del flujo operativo, liquidadas on-chain.',
      liquidityTitle: 'Liquidez programada',
      liquidityDesc: 'Salida vía tesorería SanovaAMM o mercado secundario cuando esté disponible.',
      complianceTitle: 'Cumplimiento primero',
      complianceDesc: 'KYC, disclosure fiscal por jurisdicción y registros on-chain auditables.'
    },
    cta: {
      title: 'Empezá tu portfolio de activos reales',
      subtitle: 'Accedé a real estate tokenizado con estándar institucional.',
      button: 'Abrir marketplace'
    },
    footer: {
      tagline: 'RWA · Real estate tokenizado',
      disclaimer:
        'Este sitio tiene fines informativos y no constituye oferta de venta ni solicitud de compra de valores. El rendimiento pasado no garantiza resultados futuros. Consultá asesores habilitados antes de invertir.',
      rights: '© 2019–2026 Sanova Global. Todos los derechos reservados.',
      privacy: 'Privacidad',
      terms: 'Términos'
    }
  },
  access: {
    title: 'Acceso a la plataforma',
    subtitle: 'Iniciá sesión si ya tenés cuenta, o registrate y completá el KYC para invertir en propiedades tokenizadas.',
    loginTitle: 'Iniciar sesión',
    loginDesc: 'Accedé al marketplace y a tu portfolio con tu cuenta verificada y wallet conectada.',
    loginButton: 'Ir al marketplace',
    registerTitle: 'Crear cuenta',
    registerDesc: 'Registrate como nuevo inversor. Deberás completar la verificación de identidad (KYC) antes de tu primera compra.',
    registerButton: 'Registrarse e iniciar KYC',
    kycTitle: 'Verificación de identidad (KYC)',
    kycDesc: 'El cumplimiento regulatorio exige verificar tu identidad. El proceso lo gestiona nuestro partner de onboarding regulado.',
    kycButton: 'Continuar al KYC',
    backHome: 'Volver al inicio'
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
