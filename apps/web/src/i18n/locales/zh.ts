import type { Messages } from './en';

export const zh: Messages = {
  brand: {
    portalSubtitle: 'RWA 门户'
  },
  common: {
    buyNow: '立即购买',
    investNow: '立即投资',
    reserveTokens: '预订代币',
    completeKyc: '完成 KYC',
    projectedApy: '预计 APY',
    location: '位置',
    backToMarketplace: '返回市场'
  },
  propertyCard: {
    kycRequired: '购买前需完成身份验证。',
    readyForCheckout: '您已通过验证，请继续 Web3 结账。',
    placementProgress: '配售进度',
    tokenPrice: '单价 / 代币',
    estimatedAnnualIncome: '预计年收入',
    perToken: '代币',
    instantLiquidity: '通过国库即时退出（−3% SanovaAMM）',
    limitedAvailability: '数量有限',
    viewMap: '查看地图'
  },
  marketplace: {
    title: 'RWA 市场',
    subtitle: '具有即时流动性和有竞争力借贷利率的代币化真实资产。',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: '最佳借贷利率',
    tokensAvailable: '可用代币',
    loading: '正在加载项目…',
    empty: '目前没有活跃列表。',
    error: '无法加载实时数据，显示演示列表。',
    lendingBanner: '聚合自 Aave、Compound 和 Maker',
    syncing: '正在同步实时数据…',
    trustKyc: 'KYC 认证投资者',
    trustRegulation: '已披露税务制度',
    trustOnchain: '链上结算'
  },
  nav: {
    language: '语言',
    home: '首页',
    dashboard: '仪表盘',
    marketplace: '市场',
    myAssets: '我的资产',
    cashFlow: '现金流',
    signOut: '退出登录'
  },
  checkout: {
    notFound: '未找到项目。',
    title: '结账',
    kycReady: 'KYC 已通过 · 可进行链上签名',
    tokenQuantity: '代币数量',
    lessTokens: '减少代币',
    moreTokens: '增加代币',
    maxAvailable: '最多 {count} 可用',
    pricePerToken: '代币单价',
    subtotal: '小计（{count} 代币）',
    total: '总计（{currency}）',
    requestSent: '请求已发送 — 请查看钱包',
    signing: '正在签名交易…',
    confirmPurchase: '确认链上购买',
    connectToContinue: '连接钱包以继续'
  },
  wallet: {
    disconnect: '断开连接',
    connecting: '连接中…',
    connect: '连接钱包（MetaMask / 注入式）',
    noWallet: '请安装 MetaMask 或兼容的浏览器钱包。'
  },
  dashboard: {
    eyebrow: '资本与覆盖',
    title: 'Sanova Global SAS — 投资组合分析',
    subtitle: '对流动性现金流、债务覆盖和代币化实物资产收益的机构级跟踪。',
    kpiDividends: '已收现金股息（USDC）',
    kpiDividendsHint: '通过链上监听器结算累计',
    kpiDebtCoverage: '活跃债务覆盖',
    kpiDebtCoverageHint: '对当前负债的摊销覆盖百分比',
    kpiAneloYield: 'Añelo 运营收益率',
    kpiAneloYieldHint: '实物资产 NAV 的预计收益率',
    chartTitle: '月度流：股息 vs. 债务服务',
    chartSubtitle: '已清算股息收入与计划债务服务的对比。',
    chartCurrency: 'USDC / USD — 合并视图',
    chartDividends: '股息收入',
    chartDebt: '债务服务',
    distributionsTitle: '最新已清算分配',
    distributionsSubtitle: '由区块链监听器索引的事件 — USDC 现金部分。',
    colDate: '日期',
    colAsset: '资产',
    colConcept: '概念',
    colAmount: 'USDC 金额',
    colStatus: '状态',
    colTx: 'Tx',
    syncing: '正在同步分配…',
    empty: '没有已记录的清算分配。',
    liveDividend: '已收到实时股息'
  },
  chart: {
    unavailable: '图表不可用',
    unavailableHint: '仪表板其余部分仍可正常使用，请刷新页面重试。'
  },
  landing: {
    nav: {
      howItWorks: 'How it works',
      properties: 'Properties',
      marketplace: 'Marketplace',
      platformAccess: '平台访问'
    },
    languageLabel: '语言',
    hero: {
      eyebrow: 'Tokenized real estate',
      title: 'Own fractional real assets.\nEarn rental income on-chain.',
      subtitle:
        'Sanova Global 将经过验证的投资者与阿根廷内乌肯省瓦卡穆尔塔（Vaca Muerta）的生产性资产连接起来——全球非常规页岩油气枢纽、世界第二大天然气储量、世界级基础设施、极具竞争力的运营成本以及巨大的油气生产潜力——并提供透明收益、KYC 合规和即时结算。',
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
      title: '目前在瓦卡穆埃尔塔运营'
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
      soldPercent: '已售 {percent}%',
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
      tagline: 'RWA · 代币化房地产',
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
    title: '平台访问',
    subtitle: '登录已有账户，或注册并完成 KYC 后投资代币化房产。',
    loginTitle: '登录',
    loginDesc: '使用已验证账户和钱包访问市场与投资组合。',
    loginButton: '前往市场',
    registerTitle: '创建账户',
    registerDesc: '注册新投资者。首次购买前需完成 KYC。',
    registerButton: '注册并开始 KYC',
    kycTitle: '身份验证 (KYC)',
    kycDesc: '合规要求通过受监管的入驻合作伙伴完成身份验证。',
    kycButton: '继续 KYC',
    backHome: '返回首页'
  },
  error: {
    eyebrow: '出现问题',
    title: '无法加载此页面',
    fallback: '门户临时错误。您可以返回市场或重试。',
    retry: '重试',
    goMarketplace: '前往市场',
    globalTitle: '意外错误',
    globalHint: '应用程序发生错误。您的会话和数据受到保护。'
  }
};
