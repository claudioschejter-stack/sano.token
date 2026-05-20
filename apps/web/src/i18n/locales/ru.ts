import type { Messages } from './en';

export const ru: Messages = {
  brand: {
    portalSubtitle: 'Портал RWA'
  },
  common: {
    buyNow: 'Купить сейчас',
    investNow: 'Инвестировать',
    reserveTokens: 'Забронировать токены',
    completeKyc: 'Пройти KYC',
    projectedApy: 'Прогноз APY',
    location: 'Локация',
    backToMarketplace: 'Вернуться в маркетплейс',
    whatsappLabel: 'Chat with us on WhatsApp',
    whatsappMessage: 'Hello, I am contacting you from the Sanova Global website.'
  },
  propertyCard: {
    kycRequired: 'Перед покупкой требуется верификация личности.',
    readyForCheckout: 'Вы верифицированы. Перейдите к Web3-оплате.',
    placementProgress: 'Прогресс размещения',
    tokenPrice: 'Цена / токен',
    estimatedAnnualIncome: 'Ожидаемый годовой доход',
    perToken: 'токен',
    instantLiquidity: 'Мгновенный выход через казначейство (−3% SanovaAMM)',
    limitedAvailability: 'Ограниченная доступность',
    viewMap: 'Показать на карте'
  },
  marketplace: {
    title: 'RWA Маркетплейс',
    subtitle: 'Токенизированные реальные активы с мгновенной ликвидностью и конкурентными ставками займа.',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: 'Лучшая ставка займа',
    tokensAvailable: 'токенов доступно',
    loading: 'Загрузка предложений…',
    empty: 'Сейчас нет активных листингов.',
    error: 'Не удалось загрузить live-данные. Показаны демо-листинги.',
    lendingBanner: 'Агрегировано из Aave, Compound и Maker',
    syncing: 'Синхронизация live-данных…',
    trustKyc: 'Инвесторы с KYC',
    trustRegulation: 'Раскрыт налоговый режим',
    trustOnchain: 'Расчёт on-chain'
  },
  nav: {
    language: 'Язык',
    home: 'Главная',
    dashboard: 'Дашборд',
    marketplace: 'Маркетплейс',
    myAssets: 'Мои активы',
    cashFlow: 'Денежный поток',
    signOut: 'Выйти'
  },
  checkout: {
    notFound: 'Проект не найден.',
    title: 'Оформление',
    kycReady: 'KYC одобрен · готов к подписи on-chain',
    tokenQuantity: 'Количество токенов',
    lessTokens: 'Меньше токенов',
    moreTokens: 'Больше токенов',
    maxAvailable: 'Макс. {count} доступно',
    pricePerToken: 'Цена за токен',
    subtotal: 'Промежуточный итог ({count} токенов)',
    total: 'Итого ({currency})',
    requestSent: 'Заявка отправлена — проверьте кошелёк',
    signing: 'Подписание транзакции…',
    confirmPurchase: 'Подтвердить покупку on-chain',
    connectToContinue: 'Подключите кошелёк для продолжения'
  },
  wallet: {
    disconnect: 'Отключить',
    connecting: 'Подключение…',
    connect: 'Подключить кошелёк (MetaMask / injected)',
    noWallet: 'Установите MetaMask или совместимый браузерный кошелёк.'
  },
  dashboard: {
    eyebrow: 'Капитал и покрытие',
    title: 'Sanova Global SAS — Аналитика портфеля',
    subtitle:
      'Институциональный мониторинг денежного потока, покрытия долга и доходности токенизированных физических активов.',
    kpiDividends: 'Полученные дивиденды в cash (USDC)',
    kpiDividendsHint: 'Накоплено через on-chain listener',
    kpiDebtCoverage: 'Активное покрытие долга',
    kpiDebtCoverageHint: '% амортизации, покрытой текущим обязательством',
    kpiAneloYield: 'Доходность операций Añelo',
    kpiAneloYieldHint: 'Прогнозная доходность на NAV физического актива',
    chartTitle: 'Месячный поток: дивиденды vs. обслуживание долга',
    chartSubtitle: 'Ликвидированные дивиденды против запланированного обслуживания долга.',
    chartCurrency: 'USDC / USD — консолидированный вид',
    chartDividends: 'Доход от дивидендов',
    chartDebt: 'Обслуживание долга',
    distributionsTitle: 'Последние ликвидированные выплаты',
    distributionsSubtitle: 'События из blockchain listener — cash-транш в USDC.',
    colDate: 'Дата',
    colAsset: 'Актив',
    colConcept: 'Концепт',
    colAmount: 'Сумма USDC',
    colStatus: 'Статус',
    colTx: 'Tx',
    syncing: 'Синхронизация выплат…',
    empty: 'Нет зарегистрированных ликвидированных выплат.',
    liveDividend: 'Получен live-дивиденд'
  },
  chart: {
    unavailable: 'График недоступен',
    unavailableHint: 'Остальная часть дашборда работает. Перезагрузите страницу.'
  },
  landing: {
    nav: {
      howItWorks: 'How it works',
      properties: 'Properties',
      marketplace: 'Marketplace',
      platformAccess: 'Доступ к платформе'
    },
    languageLabel: 'Язык',
    hero: {
      eyebrow: 'Tokenized real estate',
      title: 'Own fractional real assets.\nEarn rental income on-chain.',
      subtitle:
        'Sanova Global связывает верифицированных инвесторов с продуктивной недвижимостью в Вака-Муэрта, Неукен, Аргентина — мировой центр сланцевой нефти и газа, вторая по величине запас газа, инфраструктура мирового класса, конкурентные операционные затраты и огромный потенциал добычи — плюс прозрачная доходность, KYC и мгновенные расчёты.',
      ctaPrimary: 'Browse properties',
      ctaSecondary: 'How it works',
      trustLine: 'Regulated frameworks · KYC/AML · On-chain distributions in USDC'
    },
    stats: {
      properties: 'Live offerings',
      investors: 'Verified investors',
      distributed: 'USDC distributed',
      avgApy: 'Avg. projected APY'
    },
    operators: {
      title: 'В настоящее время работают в Вака-Муэрте'
    },
    macroThesis: {
      eyebrow: 'Macro Context & Investment Thesis',
      title: 'The Energy Engine of the West: Real-Asset Opportunity',
      intro:
        'Vaca Muerta is not an exploratory promise — it holds the world\'s second-largest shale gas reserves and fourth-largest shale oil reserves. At a scale comparable to the U.S. Permian Basin, leading energy multinationals invest over US$ 9 billion annually to expand production.',
      mapCaption:
        '📍 Patagonia, Argentina | 30,000 km² (Surface area comparable to Belgium)',
      mapFormationLine1: 'Formation',
      mapFormationLine2: 'VACA',
      mapFormationLine3: 'MUERTA',
      thesisTitle: 'The Infrastructure Gap: Our Investment Thesis',
      thesisDesc:
        'This massive acceleration requires physical facilities the region does not yet have. Sanova Global tokenizes the prime infrastructure that supports this monumental operation.',
      benefits: [
        'Inelastic Corporate Demand (B2B): Complexes leased to operators.',
        'Resilient Contracts: Cap rates above the global market.',
        'Structural Efficiency: Optimized tax and fiscal architecture.',
        'Global Cash Flow (USDC): Cash dividends directly to your wallet.'
      ],
      cta: 'Explore Tokenized Assets'
    },
    howItWorks: {
      title: 'Invest in four steps',
      subtitle: 'From discovery to on-chain ownership.',
      step1Title: 'Complete KYC',
      step1Desc: 'Verify your identity once with regulated onboarding partners.',
      step2Title: 'Choose a property',
      step2Desc: 'Browse tokenized assets with disclosed fiscal regime and APY.',
      step3Title: 'Receive distributions',
      step3Desc: 'Rental income flows to your wallet in USDC.',
      step4Title: 'Join our Secondary Market',
      step4Desc: 'Buy and sell your tokens with other investors on the platform.'
    },
    featured: {
      title: 'Featured properties',
      subtitle: 'Curated real-world assets with transparent token economics.',
      viewAll: 'View all listings',
      soldPercent: '{percent}% размещено',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Why Sanova RWA',
      incomeTitle: 'Recurring rental income',
      incomeDesc: 'Monthly distributions from operating cash flow, settled on-chain.',
      liquidityTitle: 'Programmed liquidity',
      liquidityDesc: 'Exit via SanovaAMM treasury when available.',
      complianceTitle: 'Compliance-first',
      complianceDesc: 'KYC, fiscal disclosure, and auditable on-chain records.'
    },
    cta: {
      title: 'Start building your real-asset portfolio',
      subtitle: 'Access institutional-grade tokenized real estate.',
      button: 'Open marketplace'
    },
    footer: {
      tagline: 'RWA · Токенизированная недвижимость',
      disclaimer:
        'This site is for informational purposes only and does not constitute an offer to sell securities.',
      rights: '© 2019–2026 Sanova Global. All rights reserved.',
      contact: 'Contact',
      privacy: 'Privacy',
      terms: 'Terms'
    }
  },
  contact: {
    title: 'Contact',
    subtitle: 'Send us your inquiry and our team will get back to you shortly.',
    nameLabel: 'Full name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    messageLabel: 'Message',
    messagePlaceholder: 'How can we help you?',
    submit: 'Send message',
    successTitle: 'Message sent',
    successDesc: 'Thank you for contacting Sanova Global. We will respond as soon as possible.',
    backHome: 'Back to home'
  },
  access: {
    title: 'Доступ к платформе',
    subtitle: 'Войдите или зарегистрируйтесь и пройдите KYC для инвестиций.',
    loginTitle: 'Вход',
    loginDesc: 'Доступ к маркетплейсу и портфелю с верифицированным аккаунтом.',
    loginButton: 'Перейти в маркетплейс',
    registerTitle: 'Создать аккаунт',
    registerDesc: 'Регистрация инвестора. KYC обязателен перед первой покупкой.',
    registerButton: 'Регистрация и KYC',
    kycTitle: 'Верификация личности (KYC)',
    kycDesc: 'Регуляторные требования — проверка через нашего партнёра.',
    kycButton: 'Перейти к KYC',
    backHome: 'На главную'
  },
  error: {
    eyebrow: 'Что-то пошло не так',
    title: 'Не удалось загрузить этот экран',
    fallback: 'Временная ошибка портала. Вернитесь в маркетплейс или повторите попытку.',
    retry: 'Повторить',
    goMarketplace: 'В маркетплейс',
    globalTitle: 'Непредвиденная ошибка',
    globalHint: 'Произошла ошибка приложения. Ваша сессия и данные защищены.'
  }
};
