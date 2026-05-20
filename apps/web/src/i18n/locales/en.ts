export const en = {
  brand: {
    portalSubtitle: 'RWA Portal'
  },
  common: {
    buyNow: 'Buy Now',
    investNow: 'Invest now',
    reserveTokens: 'Reserve tokens',
    completeKyc: 'Complete KYC',
    projectedApy: 'Projected APY',
    location: 'Location',
    backToMarketplace: 'Back to marketplace'
  },
  propertyCard: {
    kycRequired: 'Identity verification required before purchase.',
    readyForCheckout: 'You are verified. Proceed to Web3 checkout.',
    placementProgress: 'Placement progress',
    tokenPrice: 'Price / token',
    estimatedAnnualIncome: 'Est. annual income',
    perToken: 'token',
    instantLiquidity: 'Instant exit via treasury (−3% SanovaAMM)',
    limitedAvailability: 'Limited availability',
    viewMap: 'View on map'
  },
  marketplace: {
    title: 'RWA Marketplace',
    subtitle: 'Tokenized real assets with instant liquidity and competitive lending rates.',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: 'Best borrow rate',
    tokensAvailable: 'tokens available',
    loading: 'Loading listings…',
    empty: 'No active listings at the moment.',
    error: 'Could not load live data. Showing demo listings.',
    lendingBanner: 'Aggregated from Aave, Compound and Maker',
    syncing: 'Syncing live data…',
    trustKyc: 'KYC verified investors',
    trustRegulation: 'Fiscal regime disclosed',
    trustOnchain: 'On-chain settlement'
  },
  nav: {
    language: 'Language',
    dashboard: 'Dashboard',
    marketplace: 'Marketplace',
    myAssets: 'My Assets',
    cashFlow: 'Cash Flow',
    signOut: 'Sign Out'
  },
  checkout: {
    notFound: 'Project not found.',
    title: 'Checkout',
    kycReady: 'KYC approved · ready to sign on-chain',
    tokenQuantity: 'Token quantity',
    lessTokens: 'Fewer tokens',
    moreTokens: 'More tokens',
    maxAvailable: 'Max. {count} available',
    pricePerToken: 'Price per token',
    subtotal: 'Subtotal ({count} tokens)',
    total: 'Total ({currency})',
    requestSent: 'Request sent — check your wallet',
    signing: 'Signing transaction…',
    confirmPurchase: 'Confirm on-chain purchase',
    connectToContinue: 'Connect your wallet to continue'
  },
  wallet: {
    disconnect: 'Disconnect',
    connecting: 'Connecting…',
    connect: 'Connect wallet (MetaMask / injected)',
    noWallet: 'Install MetaMask or a compatible browser wallet.'
  },
  dashboard: {
    eyebrow: 'Capital & Coverage',
    title: 'Sanova Global SAS — Portfolio Analytics',
    subtitle:
      'Institutional tracking of liquid cash flow, debt coverage and tokenized physical asset performance.',
    kpiDividends: 'Cash Dividends Received (USDC)',
    kpiDividendsHint: 'Settled total via on-chain listener',
    kpiDebtCoverage: 'Active Debt Coverage',
    kpiDebtCoverageHint: '% amortization covered against outstanding liability',
    kpiAneloYield: 'Añelo Operations Yield',
    kpiAneloYieldHint: 'Projected yield on physical asset NAV',
    chartTitle: 'Monthly flow: dividends vs. debt service',
    chartSubtitle: 'Liquidated dividend income vs. scheduled debt service.',
    chartCurrency: 'USDC / USD — consolidated view',
    chartDividends: 'Dividend income',
    chartDebt: 'Debt service',
    distributionsTitle: 'Latest Liquidated Distributions',
    distributionsSubtitle: 'Events indexed by blockchain listener — cash tranche in USDC.',
    colDate: 'Date',
    colAsset: 'Asset',
    colConcept: 'Concept',
    colAmount: 'Amount USDC',
    colStatus: 'Status',
    colTx: 'Tx',
    syncing: 'Syncing distributions…',
    empty: 'No liquidated distributions recorded.',
    liveDividend: 'Live dividend received'
  },
  chart: {
    unavailable: 'Chart unavailable',
    unavailableHint: 'The rest of the dashboard remains operational. Reload the page to retry.'
  },
  error: {
    eyebrow: 'Something went wrong',
    title: 'We could not load this view',
    fallback: 'Temporary portal error. You can return to the marketplace or retry.',
    retry: 'Retry',
    goMarketplace: 'Go to marketplace',
    globalTitle: 'Unexpected error',
    globalHint: 'An application error occurred. Your session and data are protected.'
  }
} as const;

export type Messages = {
  brand: {
    portalSubtitle: string;
  };
  common: {
    buyNow: string;
    investNow: string;
    reserveTokens: string;
    completeKyc: string;
    projectedApy: string;
    location: string;
    backToMarketplace: string;
  };
  propertyCard: {
    kycRequired: string;
    readyForCheckout: string;
    placementProgress: string;
    tokenPrice: string;
    estimatedAnnualIncome: string;
    perToken: string;
    instantLiquidity: string;
    limitedAvailability: string;
    viewMap: string;
  };
  marketplace: {
    title: string;
    subtitle: string;
    brandLabel: string;
    bestBorrowRate: string;
    tokensAvailable: string;
    loading: string;
    empty: string;
    error: string;
    lendingBanner: string;
    syncing: string;
    trustKyc: string;
    trustRegulation: string;
    trustOnchain: string;
  };
  nav: {
    language: string;
    dashboard: string;
    marketplace: string;
    myAssets: string;
    cashFlow: string;
    signOut: string;
  };
  checkout: {
    notFound: string;
    title: string;
    kycReady: string;
    tokenQuantity: string;
    lessTokens: string;
    moreTokens: string;
    maxAvailable: string;
    pricePerToken: string;
    subtotal: string;
    total: string;
    requestSent: string;
    signing: string;
    confirmPurchase: string;
    connectToContinue: string;
  };
  wallet: {
    disconnect: string;
    connecting: string;
    connect: string;
    noWallet: string;
  };
  dashboard: {
    eyebrow: string;
    title: string;
    subtitle: string;
    kpiDividends: string;
    kpiDividendsHint: string;
    kpiDebtCoverage: string;
    kpiDebtCoverageHint: string;
    kpiAneloYield: string;
    kpiAneloYieldHint: string;
    chartTitle: string;
    chartSubtitle: string;
    chartCurrency: string;
    chartDividends: string;
    chartDebt: string;
    distributionsTitle: string;
    distributionsSubtitle: string;
    colDate: string;
    colAsset: string;
    colConcept: string;
    colAmount: string;
    colStatus: string;
    colTx: string;
    syncing: string;
    empty: string;
    liveDividend: string;
  };
  chart: {
    unavailable: string;
    unavailableHint: string;
  };
  error: {
    eyebrow: string;
    title: string;
    fallback: string;
    retry: string;
    goMarketplace: string;
    globalTitle: string;
    globalHint: string;
  };
};
