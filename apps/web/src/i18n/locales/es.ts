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
    backToMarketplace: 'Volver al marketplace',
    whatsappLabel: 'Escribinos por WhatsApp',
    whatsappMessage: 'Hola, me contacto desde el sitio web de Sanova Global.'
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
        'Vaca Muerta no es solo la segunda reserva de gas del planeta; es el epicentro global del shale no convencional. Su acelerado crecimiento ha generado un déficit crítico de infraestructura estratégica. A través de la tokenización de activos (RWA), Sanova Global conecta capital global con desarrollos inmobiliarios y comerciales prime en el corredor estratégico de la cuenca, respaldados por contratos de alquiler B2B con las principales operadoras energéticas. Ofrecemos exposición directa al sector más dinámico de Argentina con rendimientos en moneda dura, cumplimiento regulatorio (KYC) estricto y liquidación automatizada de dividendos.',
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
      title: 'Empresas que operan en Vaca Muerta',
      subtitle:
        'Estas son algunas de las empresas petroleras y gasíferas con operaciones en la cuenca'
    },
    macroThesis: {
      eyebrow: 'Contexto Macro & Tesis de Inversión',
      title: 'El Motor Energético de Occidente: Oportunidad en Activos Reales',
      intro:
        'Vaca Muerta no es una promesa exploratoria; es la segunda reserva mundial de shale gas y la cuarta de shale oil. Con una escala comparable a la cuenca Permian en EE. UU., las principales multinacionales energéticas inyectan más de US$ 9.000 millones anuales para expandir su producción.',
      mapCaption:
        '📍 Patagonia, Argentina (38°S) | Cuenca Vaca Muerta: 30.000 km² — equivalente a Bélgica',
      thesisTitle: 'El Déficit de Infraestructura: Nuestra Tesis de Inversión',
      thesisDesc:
        'Esta aceleración masiva exige instalaciones físicas que la región hoy no posee. Sanova Global tokeniza la infraestructura prime que sostiene esta operación monumental.',
      benefits: [
        'Demanda Corporativa Inelástica (B2B): Complejos alquilados a operadoras.',
        'Contratos Resilientes: Cap Rates superiores al mercado global.',
        'Eficiencia Estructural: Arquitectura fiscal e impositiva optimizada.',
        'Flujo de Caja Global (USDC): Dividendos en efectivo directo a su wallet.'
      ],
      cta: 'Explorar Activos Tokenizados'
    },
    howItWorks: {
      title: 'Invertí en cuatro pasos',
      subtitle: 'Del descubrimiento a la titularidad on-chain — para inversores retail e institucionales.',
      step1Title: 'Completá tus Datos (KYC)',
      step1Desc: 'Verificá tu identidad una vez. Sanova integra proveedores de onboarding regulados.',
      step2Title: 'Elegí una propiedad',
      step2Desc:
        'Explorá activos tokenizados con información real de contratos, APY y avance de colocación informados.',
      step3Title: 'Recibí distribuciones',
      step3Desc: 'Los ingresos por alquiler llegan a tu wallet en USDC. Seguimiento en el portal inversor.',
      step4Title: 'Participá de nuestro Mercado Secundario',
      step4Desc:
        'Comprá y vende tus tokenes a otros inversores de la plataforma. Obteniendo liquidez inmediata.'
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
      incomeDesc: 'Distribuciones semanales o mensuales del flujo operativo, liquidadas on-chain.',
      liquidityTitle: 'Liquidez programada',
      liquidityDesc:
        'Salida vía tesorería Sanova o mercado secundario. Recompramos tus tokenes o los puedes vender en nuestra plataforma. Con liquidez inmediata.',
      complianceTitle: 'Cumplimiento primero',
      complianceDesc:
        'KYC, disclosure legal de documentación del mundo real y registros on-chain auditables.'
    },
    cta: {
      title: 'Empezá tu portfolio de activos reales',
      subtitle: 'Accedé a real estate tokenizado con estándar institucional.',
      button: 'Abrir marketplace'
    },
    footer: {
      tagline: 'RWA · Real estate tokenizado',
      disclaimer:
        'Gestión de capital con foco en la integridad y la preservación de valor. Sanova Global SAS provee este ecosistema digital con fines informativos, integrando tecnología de vanguardia con la solidez de los activos físicos. Comprendemos que toda inversión involucra alguna variable de mercado y que los resultados previos son, en algunos casos, referenciales y no garantías absolutas. Diseñamos nuestras operaciones con los más altos estándares de integridad, cumplimiento y compromiso para su tranquilidad.',
      rights: '© 2026 Sanova Global SAS. Todos los derechos reservados.',
      contact: 'Contacto',
      privacy: 'Privacidad',
      terms: 'Términos'
    }
  },
  contact: {
    title: 'Contacto',
    subtitle: 'Envianos tu consulta y nuestro equipo te responderá a la brevedad.',
    nameLabel: 'Nombre completo',
    namePlaceholder: 'Tu nombre',
    emailLabel: 'Email',
    emailPlaceholder: 'tu@email.com',
    messageLabel: 'Mensaje',
    messagePlaceholder: '¿En qué podemos ayudarte?',
    submit: 'Enviar mensaje',
    successTitle: 'Mensaje enviado',
    successDesc: 'Gracias por contactar a Sanova Global. Te responderemos lo antes posible.',
    backHome: 'Volver al inicio'
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
