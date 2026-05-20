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
    backToMarketplace: 'Вернуться в маркетплейс'
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
        'Sanova Global connects verified investors with income-producing properties across Latin America.',
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
    howItWorks: {
      title: 'Invest in three steps',
      subtitle: 'From discovery to on-chain ownership.',
      step1Title: 'Complete KYC',
      step1Desc: 'Verify your identity once with regulated onboarding partners.',
      step2Title: 'Choose a property',
      step2Desc: 'Browse tokenized assets with disclosed fiscal regime and APY.',
      step3Title: 'Receive distributions',
      step3Desc: 'Rental income flows to your wallet in USDC.'
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
      privacy: 'Privacy',
      terms: 'Terms'
    }
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
