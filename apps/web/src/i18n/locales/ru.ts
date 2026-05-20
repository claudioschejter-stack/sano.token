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
