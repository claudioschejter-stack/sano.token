export const en = {
  brand: {
    portalSubtitle: 'RWA Portal'
  },
  common: {
    buyNow: 'Buy Now',
    investNow: 'Access USDC rental yields',
    reserveTokens: 'Reserve tokens',
    completeKyc: 'Complete KYC',
    projectedApy: 'Projected APY',
    location: 'Location',
    backToMarketplace: 'Back to marketplace',
    whatsappLabel: 'Chat with us on WhatsApp',
    whatsappMessage: 'Hello, I am contacting you from the Sanova Global website.',
    loadingGeneric: 'Loading…'
  },
  propertyCard: {
    kycRequired: 'Identity verification required before purchase.',
    readyForCheckout: 'You are verified. Proceed to Web3 checkout.',
    placementProgress: 'Placement progress',
    tokenPrice: 'Price / token',
    tokenSymbolLabel: 'Token symbol',
    estimatedAnnualIncome: 'Est. annual income',
    fixedAnnualPayment: 'Fixed annual coupon',
    fixedCoupon: 'Fixed coupon',
    instrumentDebt: 'Debt',
    instrumentEquity: 'Equity',
    maturity: 'Maturity',
    equityParticipation: 'Asset participation',
    perToken: 'token',
    instantLiquidity: 'Instant exit via treasury (−3% SanovaAMM)',
    legalContractsBadge: 'Legal contracts',
    contractUnavailable: 'pending upload',
    limitedAvailability: 'Limited availability',
    viewMap: 'View on map',
    viewReel: 'View reel',
    contracts: {
      button: 'Contracts',
      title: 'Legal and on-chain documentation',
      subtitle: 'Access trust deed and asset contract documents.',
      trust: 'Trust constitution',
      purchase: 'Purchase agreement',
      lease: 'Lease agreement',
      smartContract: 'Smart contract (explorer)'
    }
  },
  marketplace: {
    title: 'RWA Marketplace',
    subtitle: 'Tokenized real assets with instant liquidity and competitive lending rates.',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: 'Best borrow rate',
    allBorrowRatesTitle: 'Worldwide borrow rates',
    allBorrowRatesDesc:
      'Compare lending rates against RWA collateral across DeFi and institutional lenders worldwide.',
    colLender: 'Lender',
    colRegion: 'Region',
    colCategory: 'Type',
    colBorrowRate: 'APY rate',
    bestBadge: 'Best',
    lendingRatesFootnote:
      'Indicative APY rates. Configurable via environment; connect on-chain APIs for live data.',
    lenderRegions: {
      global: 'Global',
      americas: 'Americas',
      europe: 'Europe',
      asia_pacific: 'Asia-Pacific',
      mea: 'Middle East & Africa'
    },
    lenderCategories: {
      money_market: 'Money market',
      credit_pool: 'Credit pool',
      rwa: 'RWA / real assets',
      institutional: 'Institutional'
    },
    tokensAvailable: 'tokens available',
    loading: 'Loading listings…',
    empty: 'No active listings at the moment.',
    error: 'Could not load live data. Showing demo listings.',
    lendingBanner: 'Aggregated from global DeFi and institutional lenders',
    syncing: 'Syncing live data…',
    trustKyc: 'KYC verified investors',
    trustRegulation: 'Fiscal regime disclosed',
    trustOnchain: 'On-chain settlement'
  },
  nav: {
    language: 'Language',
    home: 'Home',
    dashboard: 'Dashboard',
    marketplace: 'Marketplace',
    myAssets: 'My Assets',
    cashFlow: 'Cash Flow',
    signOut: 'Sign Out'
  },
  adminNav: {
    panel: 'Overview',
    investors: 'Investors',
    assets: 'Assets',
    treasury: 'Treasury',
    team: 'Team',
    settings: 'Settings',
    viewMarketplace: 'View marketplace'
  },
  adminDashboard: {
    eyebrow: 'Administration',
    sidebarSubtitle: 'Operations and compliance panel',
    title: 'Admin overview',
    subtitle:
      'Global view of investors, KYC, tokenized assets, and platform operations for Sanova Global.',
    backToPanel: 'Back to overview',
    comingSoon: 'This module will be available in the next iteration.',
    kycAlert: '{count} investor(s) pending KYC review.',
    kpiInvestors: 'Registered investors',
    kpiInvestorsHint: 'Investor profiles in the database',
    kpiKycPending: 'KYC pending',
    kpiKycPendingHint: 'Accounts awaiting verification',
    kpiActiveAssets: 'Active assets',
    kpiActiveAssetsHint: 'Projects published on the marketplace',
    kpiCapital: 'Capital committed',
    kpiCapitalHint: 'Sum of registered investor capital',
    kpiInvestments: 'Active investments',
    kpiInvestmentsHint: 'Positions with ACTIVE status',
    kpiStaff: 'Internal team',
    kpiStaffHint: 'Admin, treasury, and operator users',
    quickLinksTitle: 'Quick access',
    quickLinksSubtitle: 'Operational modules under construction.',
    investorsDesc: 'KYC queue, investor profiles, and onboarding status.',
    assetsDesc: 'Tokenized properties, supply, pricing, and marketplace publishing.',
    treasuryDesc: 'Distributions, cash flow, and treasury reconciliation.',
    teamDesc: 'Roles, advisors, and internal access management.',
    settingsDesc: 'Platform parameters and integrations.'
  },
  adminInvestors: {
    eyebrow: 'KYC & onboarding',
    filters: {
      ALL: 'All',
      PENDING: 'Pending',
      APPROVED: 'Approved',
      REJECTED: 'Rejected'
    },
    status: {
      PENDING: 'Pending',
      APPROVED: 'Approved',
      REJECTED: 'Rejected'
    },
    colInvestor: 'Investor',
    colEmail: 'Email',
    colWallet: 'Wallet',
    colKyc: 'KYC',
    colIdentity: 'Identity',
    colRegistered: 'Registered',
    colActions: 'Actions',
    viewIdentity: 'View data',
    hideIdentity: 'Hide',
    approve: 'Approve',
    reject: 'Reject',
    refresh: 'Refresh',
    loading: 'Loading investors…',
    error: 'Could not load investors. Try again.',
    empty: 'No investors match this filter.',
    contactPendingHint: 'Investor must verify email and phone before KYC can be approved.'
  },
  identityProfile: {
    title: 'Identity data (Didit)',
    empty: 'No identity data yet. It is filled automatically after Didit verification.',
    fullName: 'Full name',
    documentId: 'Document / tax ID',
    dateOfBirth: 'Date of birth',
    nationality: 'Nationality',
    documentType: 'Document type',
    documentExpiry: 'Expiry date',
    gender: 'Gender'
  },
  adminAssets: {
    eyebrow: 'Marketplace assets',
    filters: {
      ALL: 'All',
      ACTIVE: 'Published',
      INACTIVE: 'Unpublished'
    },
    status: {
      ACTIVE: 'Published',
      INACTIVE: 'Unpublished'
    },
    colAsset: 'Asset',
    colLocation: 'Location',
    colPrice: 'Price / token',
    colSupply: 'Supply',
    colYield: 'Target yield',
    colStatus: 'Status',
    colActions: 'Actions',
    publish: 'Publish',
    unpublish: 'Unpublish',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
    view: 'View',
    refresh: 'Refresh',
    sold: 'sold',
    activeInvestments: '{count} active investment(s)',
    fieldAvailableTokens: 'Available tokens',
    fieldPricePerToken: 'Price per token (USD)',
    loading: 'Loading assets…',
    error: 'Could not load assets. Try again.',
    empty: 'No assets match this filter.',
    saveError: 'Could not save changes. Try again.',
    validationTokens: 'Enter a valid available token count.',
    validationPrice: 'Enter a valid price greater than zero.',
    newLaunch: 'New launch',
    editLaunch: 'Edit card'
  },
  adminLaunch: {
    eyebrow: 'RWA issuance',
    createTitle: 'Build new launch',
    editTitle: 'Edit launch',
    subtitle: 'Complete the marketplace card: photos, reels, contracts, map location, tokenomics, and DeFi collateral.',
    loading: 'Loading launch…',
    loadError: 'Could not load launch.',
    save: 'Save launch',
    saving: 'Saving…',
    saveSuccess: 'Launch saved.',
    saveError: 'Could not save. Check required fields.',
    sectionBasic: 'Project information',
    sectionToken: 'Token & issuance',
    sectionMedia: 'Photos & reels',
    mediaDesc: 'Photos and videos save automatically and appear on the marketplace card when published.',
    mediaEmpty: 'No photos or videos yet. Upload files or paste a reel URL.',
    mediaSaved: 'Media saved to the card.',
    uploadVideo: 'Upload video',
    addReelUrl: 'Add URL',
    uploadError: 'Could not upload the file.',
    uploadStorageNotConfigured:
      'Storage is not configured on Vercel. Add SUPABASE_KEY (service role) and the launches bucket in Supabase.',
    uploadUnsupportedType: 'Unsupported file type.',
    uploadTooLarge: 'File too large (max 20 MB).',
    optionalBadge: 'Optional',
    sectionContracts: 'Legal contracts',
    sectionCollateral: 'DeFi protocol collateral',
    fieldTitle: 'Asset name',
    fieldDescription: 'Description',
    fieldLocation: 'Address / location',
    fieldLatitude: 'Latitude (Google Maps)',
    fieldLongitude: 'Longitude (Google Maps)',
    fieldTotalTokens: 'Tokens issued (total supply)',
    fieldAvailableTokens: 'Available tokens',
    fieldPricePerToken: 'Price per token (USD)',
    fieldInstrumentType: 'Instrument type',
    instrumentTypeDesc: 'Choose whether the token represents a fixed-yield loan (debt) or property participation (equity).',
    instrumentDebt: 'Debt instrument',
    instrumentDebtDesc: 'Loan to the project with fixed coupon and maturity. Best for Maple, Clearpool, and credit pools.',
    instrumentEquity: 'Equity instrument',
    instrumentEquityDesc: 'Direct participation in property appreciation and variable returns (rent + capital gains).',
    fieldFixedCoupon: 'Fixed annual coupon (%)',
    fieldProjectedYield: 'Projected return (%)',
    fixedCouponHint: 'Fixed rate agreed with borrower / SPV.',
    projectedYieldHint: 'Estimated rent + appreciation; not guaranteed.',
    fieldMaturityDate: 'Maturity date',
    fieldEquityShare: 'Asset participation (%)',
    equityShareHint: 'Share of cash flow and appreciation represented by each token.',
    fieldYield: 'Target yield (%)',
    fieldTokenName: 'Token name',
    fieldTokenSymbol: 'Token symbol',
    fieldTokenStandard: 'Issuance standard',
    fieldVaultAddress: 'ERC-4626 vault',
    fieldSpvEntity: 'SPV / trust entity',
    fieldNavOracle: 'NAV oracle URL',
    fieldContractAddress: 'Contract address (manual)',
    tokenStandardSanova: 'Sanova KYC (recommended — production)',
    tokenStandardErc4626: 'Sanova + ERC-4626 (DeFi vault)',
    tokenStandardThirdweb: 'Thirdweb demo (testing only)',
    tokenStandardSanovaDesc: 'KYC-enabled ERC-20. Best for regulated RWA and Centrifuge onboarding.',
    tokenStandardErc4626Desc: 'Deploys SanovaAssetToken + KYC-gated ERC-4626 vault. DeFi-compatible shares.',
    tokenStandardThirdwebDesc: 'Generic ERC-20 via Thirdweb. Demos only; not institutional collateral.',
    sectionCentrifuge: 'Centrifuge checklist',
    centrifugeDesc: 'Optional. Only needed if you plan to register the asset on Centrifuge / Tinlake.',
    centrifugeReadiness: 'Centrifuge readiness',
    centrifugeChecklist: {
      spvDocumented: 'SPV / trust documented',
      legalAuditDone: 'Legal audit completed',
      navOracleConfigured: 'NAV oracle configured',
      kycPolicyActive: 'KYC policy active',
      liquidityPlanDocumented: 'Liquidity plan documented',
      smartContractVerified: 'Smart contract verified on-chain'
    },
    mapHint: 'Get lat/lng from Google Maps → right-click pin → copy coordinates.',
    uploadPhoto: 'Upload photo',
    uploading: 'Uploading…',
    reelPlaceholder: 'Reel URL (YouTube, Instagram, or MP4)',
    contractsDesc: 'PDFs shown via the Contracts button on the marketplace card.',
    contractLabels: {
      trust: 'Trust deed',
      purchase: 'Purchase agreement',
      lease: 'Lease agreement',
      smartContract: 'Smart contract'
    },
    noFile: 'No file',
    uploadPdf: 'Upload PDF',
    collateralDesc: 'Optional. Select DeFi protocols only if you want to register the token as collateral later.',
    collateralNote: 'Centrifuge, Sky, Morpho, Aave Horizon, Maple, Clearpool, and Figure require institutional review. Sanova validates requirements, builds the collateral package, and submits via API/webhook when credentials are set in .env (Settings → DeFi integrations).',
    registerCollateral: 'Register collateral with protocols',
    collateralRegisterSuccess: 'Collateral submitted to selected protocols.',
    collateralRegisterPending: 'Requirements evaluated. Configure API credentials or webhook for automatic submission.',
    collateralRegisterError: 'Could not register collateral.',
    collateralMissing: 'Missing requirements',
    collateralAutoTriggered: 'Collateral registration started automatically',
    collateralStatuses: {
      NOT_SELECTED: 'Not selected',
      BLOCKED: 'Blocked — requirements missing',
      READY: 'Ready to submit',
      QUEUED: 'Queued',
      SUBMITTING: 'Submitting…',
      SUBMITTED: 'Submitted — institutional review',
      REGISTERED: 'Registered as collateral',
      REJECTED: 'Rejected',
      FAILED: 'Failed'
    },
    publishOnSave: 'Publish on marketplace when saving',
    tokenDeployTitle: 'On-chain token issuance',
    tokenDeployDesc: 'Optional. Issue the token on-chain or paste the contract address manually.',
    tokenDeployOptionalHint:
      'Automatic issuance is not configured (TOKEN_DEPLOY_PRIVATE_KEY missing). You can still publish the card and enter the contract address manually.',
    tokenDeployThirdwebHint:
      'Thirdweb is not configured. Use manual contract entry or set THIRDWEB_SECRET_KEY for demos only.',
    deployToken: 'Issue token',
    autoDeployOnCreate: 'Try automatic issuance on create (optional)',
    tokenStatus: 'Status',
    tokenSkipped: 'Automatic issuance skipped',
    tokenDeployed: 'Token deployed. Check the explorer.',
    tokenRequested: 'Issuance request recorded.',
    tokenDeployError: 'Failed to request token issuance.'
  },
  adminTeam: {
    designateTitle: 'Designate advisor',
    designateDesc: 'Administrators assign advisor managers and advisors in the network.',
    email: 'Email',
    name: 'Name',
    role: 'Role',
    roleAdvisor: 'Advisor',
    roleManager: 'Advisor manager',
    upline: 'Reports to (manager)',
    selectUpline: 'Select manager…',
    designate: 'Designate',
    designating: 'Designating…',
    designateSuccess: 'Advisor designated successfully.',
    designateError: 'Could not designate advisor.',
    advisorsTitle: 'Advisor network',
    membersTitle: 'Team & KYC verification',
    membersDesc:
      'Identity data from Didit, verified email and phone for every platform role.',
    colFullName: 'Full name',
    colIdentification: 'ID number',
    colEmail: 'Email',
    colEmailVerified: 'Email verified',
    colPhone: 'Phone',
    colPhoneVerified: 'Phone verified',
    colRole: 'Role',
    colUpline: 'Upline',
    colClients: 'Clients',
    colDownline: 'Team',
    verificationPending: 'Pending',
    loading: 'Loading team…',
    error: 'Could not load team.',
    empty: 'No advisors designated yet.',
    emptyMembers: 'No registered users yet.',
    nominationsTitle: 'Advisor requests',
    nominationsDesc: 'Advisors suggest new members; the administrator approves or rejects.',
    colSuggestedBy: 'Suggested by',
    colStatus: 'Status',
    colDate: 'Date',
    approve: 'Approve',
    reject: 'Reject',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    noNominations: 'No pending requests.',
    refresh: 'Refresh'
  },
  adminSettings: {
    loading: 'Loading settings…',
    error: 'Could not load settings. Try again.',
    refresh: 'Refresh',
    save: 'Save changes',
    saving: 'Saving…',
    saveSuccess: 'Settings saved successfully.',
    saveError: 'Could not save changes. Try again.',
    validationWhatsapp: 'Enter a valid WhatsApp number (country code + number).',
    validationEmail: 'Enter a valid contact email.',
    validationSiteUrl: 'Enter a valid site URL (http or https).',
    contactTitle: 'Contact & site',
    contactDesc: 'Public contact details. Changes are stored in the database and override environment variables.',
    whatsappPhone: 'WhatsApp (digits only, with country code)',
    contactEmail: 'Contact email',
    siteUrl: 'Site URL',
    sources: {
      database: 'Saved in platform',
      environment: 'Environment variable',
      default: 'Default value'
    },
    integrationsTitle: 'Integrations',
    integrationsDesc: 'Status of external services configured on the server.',
    integrations: {
      email: 'Email (Resend)',
      sms: 'SMS (Twilio)',
      kyc: 'KYC (Didit)',
      googleOAuth: 'Google OAuth',
      appleOAuth: 'Apple OAuth',
      walletConnect: 'WalletConnect',
      blockchain: 'Blockchain / RPC',
      redis: 'Redis / queues',
      thirdweb: 'Thirdweb (tokens demo)',
      supabaseStorage: 'Supabase Storage',
      collateralWebhook: 'DeFi collateral webhook',
      centrifuge: 'Centrifuge Hub',
      morpho: 'Morpho',
      maple: 'Maple Finance',
      figure: 'Figure Markets'
    },
    configured: 'Configured',
    notConfigured: 'Not configured',
    accessTitle: 'Access & security',
    accessDesc: 'Administrators and authentication providers.',
    adminEmails: 'Admin emails',
    noAdminEmails: 'No emails in AUTH_ADMIN_EMAILS.',
    oauthGoogle: 'Google Sign-In',
    oauthApple: 'Apple Sign-In',
    operationsTitle: 'Operations',
    operationsDesc: 'Operational flags from the deployment environment.',
    nodeEnv: 'Environment',
    allowDemoKyc: 'Demo KYC',
    bullEnabled: 'Bull/Redis queues',
    onboardingDevExposeCode: 'Show OTP codes on screen',
    enabled: 'Enabled',
    disabled: 'Disabled',
    envNote: 'Integrations and operational flags are set via environment variables on Vercel or the server. A redeploy is required to apply changes.'
  },
  adminTreasury: {
    loading: 'Loading treasury…',
    error: 'Could not load treasury data. Try again.',
    refresh: 'Refresh',
    kpiCapital: 'Capital committed',
    kpiCapitalHint: '{count} registered investor(s)',
    kpiMarginDebt: 'Margin debt',
    kpiMarginDebtHint: 'Active liability across investor portfolios',
    kpiPayouts: 'Executed payouts',
    kpiPayoutsHint: '{count} pending payout(s)',
    kpiLiquidPaid: 'Liquid cash paid',
    kpiLiquidPaidHint: '{offset} applied to debt cancellation',
    payoutsTitle: 'Project payout history',
    payoutsDesc: 'On-chain distributions recorded in PayoutHistory.',
    distributionsTitle: 'Investor distributions',
    distributionsDesc: '{count} total record(s) in DividendDistribution.',
    filters: {
      ALL: 'All',
      PENDING: 'Pending',
      SUCCESS: 'Successful',
      FAILED: 'Failed'
    },
    payoutStatus: {
      PENDING: 'Pending',
      SUCCESS: 'Successful',
      FAILED: 'Failed'
    },
    colProject: 'Project',
    colDate: 'Date',
    colTotal: 'Total paid',
    colLiquid: 'Cash',
    colDebtOffset: 'Debt offset',
    colStatus: 'Status',
    colTx: 'Tx hash',
    colInvestor: 'Investor',
    colAsset: 'Asset',
    colAmount: 'Amount',
    colMarginApplied: 'Applied to margin',
    receiptCount: '{count} receipt(s)',
    emptyPayouts: 'No payouts match this filter.',
    emptyDistributions: 'No distributions recorded.',
    yes: 'Yes',
    no: 'No'
  },
  advisorPortal: {
    navClients: 'My clients',
    navSuggest: 'Suggest advisor',
    clientsTitle: 'My clients',
    clientsDescManager:
      'Read-only view of investors incorporated by you and your advisor network.',
    clientsDescAdvisor: 'Read-only view of investors you incorporated on the platform.',
    readOnlyBadge: 'Read only',
    colAdvisor: 'Incorporated by',
    suggestTitle: 'Suggest new advisor',
    suggestDesc: 'The request requires administrator approval.',
    suggestSubmit: 'Submit request',
    suggestSuccess: 'Request submitted. An administrator will review it.',
    suggestError: 'Could not submit request.',
    loading: 'Loading clients…',
    error: 'Could not load clients.',
    empty: 'You have no incorporated clients in your book yet.',
    emptyHint: 'Investors appear when an administrator assigns them to your network.'
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
  landing: {
    nav: {
      howItWorks: 'How it works',
      properties: 'Properties',
      marketplace: 'Marketplace',
      platformAccess: 'Platform access',
      enterPlatform: 'Enter the platform'
    },
    languageLabel: 'Language',
    hero: {
      eyebrow: 'Tokenized real estate',
      title: 'Own fractional real assets.\nEarn rental income on-chain.',
      subtitle:
        'Sanova Global connects verified investors with productive properties in Vaca Muerta, Neuquén, Argentina — a premier global unconventional shale oil & gas hub with the world\'s second-largest gas reserves, world-class infrastructure, highly competitive operating costs, and vast oil & gas production potential — plus transparent yields, KYC compliance, and instant settlement.',
      ctaPrimary: 'Discover B2B cash flows',
      ctaSecondary: 'How it works',
      trustLine: 'Regulated frameworks · KYC/AML · On-chain distributions in USDC'
    },
    trustBadges: {
      ariaLabel: 'Institutional trust signals',
      labels: [
        'Automated on-chain settlement',
        'Real-estate legal audit',
        'Strict institutional compliance'
      ]
    },
    stats: {
      properties: 'Live offerings',
      investors: 'Verified investors',
      distributed: 'USDC distributed',
      avgApy: 'Avg. projected APY'
    },
    operators: {
      title: 'Companies operating in Vaca Muerta',
      subtitle: 'These are some of the oil and gas companies with operations in the basin'
    },
    macroThesis: {
      eyebrow: 'Macro Context & Investment Thesis',
      title: 'The Energy Engine of the West: Real-Asset Opportunity',
      intro:
        'Vaca Muerta is not an exploratory promise — it holds the world\'s second-largest shale gas reserves and fourth-largest shale oil reserves. At a scale comparable to the U.S. Permian Basin, leading energy multinationals invest over US$ 9 billion annually to expand production.',
      mapCaption:
        '📍 Patagonia, Argentina (38°S)\n    Vaca Muerta basin: 30,000 km² — comparable to Belgium',
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
      subtitle: 'From discovery to on-chain ownership — designed for global retail and institutional investors.',
      step1Title: 'Complete KYC',
      step1Desc: 'Verify your identity once. Sanova partners with regulated onboarding providers.',
      step2Title: 'Choose a property',
      step2Desc: 'Browse tokenized assets with disclosed fiscal regime, APY, and placement progress.',
      step3Title: 'Receive distributions',
      step3Desc: 'Rental income flows to your wallet in USDC. Track everything in the investor portal.',
      step4Title: 'Join our Secondary Market',
      step4Desc: 'Buy and sell your tokens with other investors on the platform.'
    },
    featured: {
      title: 'Featured properties',
      subtitle: 'Curated real-world assets with transparent token economics.',
      viewAll: 'View all listings',
      soldPercent: '{percent}% sold',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Why Sanova RWA',
      incomeTitle: 'Recurring rental income',
      incomeDesc: 'Monthly distributions from operating cash flow, settled on-chain.',
      liquidityTitle: 'Programmed liquidity',
      liquidityDesc: 'Exit via SanovaAMM treasury or secondary mechanisms when available.',
      complianceTitle: 'Compliance-first',
      complianceDesc: 'KYC, fiscal disclosure per jurisdiction, and auditable on-chain records.'
    },
    cta: {
      title: 'Start building your real-asset portfolio',
      subtitle: 'Join investors accessing institutional-grade tokenized real estate.',
      button: 'Open marketplace'
    },
    footer: {
      tagline: 'RWA · Tokenized real estate',
      disclaimer:
        'This site is for informational purposes only and does not constitute an offer to sell or solicitation to buy securities. Past performance does not guarantee future results. Consult licensed advisors before investing.',
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
    submitting: 'Sending…',
    errorSend: 'We could not send your message. Please try again in a few minutes.',
    formNote:
      'You will be redirected briefly and return here. On first use, check your inbox (claudioschejter@gmail.com) and activate the one-time FormSubmit confirmation link.',
    successTitle: 'Message sent',
    successDesc: 'Thank you for contacting Sanova Global. We will respond as soon as possible.',
    backHome: 'Back to home'
  },
  access: {
    title: 'Platform access',
    subtitle:
      'Sign in with your email and password. Your profile determines whether you access as admin, advisor, advisor manager, or investor.',
    loginTitle: 'Sign in',
    loginDesc: 'Access the marketplace and your portfolio with your verified account.',
    loginButton: 'Go to marketplace',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Your password',
    signInButton: 'Sign in',
    forgotPassword: 'Forgot password',
    invalidCredentials: 'Incorrect email or password.',
    signingIn: 'Signing in…',
    signedInAs: 'Signed in as',
    roleLabel: 'Role',
    continueButton: 'Continue',
    sessionActiveTitle: 'You already have an active session',
    sessionPendingDesc:
      'Your account is not operational yet. Verify your email and phone to continue.',
    sessionRegisteredDesc:
      'Account created successfully. Verify your email and phone to activate your account.',
    continueVerification: 'Continue onboarding',
    switchAccount: 'Sign out and use another account',
    authError: 'We could not complete sign-in. Check OAuth configuration or try again.',
    rolesTitle: 'Platform roles',
    rolesDesc: 'After sign-in, your account is classified automatically based on your authorized email.',
    roles: {
      ADMIN: 'Administrator',
      ADVISOR_MANAGER: 'Advisor manager',
      ADVISOR: 'Advisor',
      INVESTOR: 'Investor',
      TREASURY: 'Treasury',
      OPERATOR: 'Operator'
    },
    roleDescriptions: {
      ADMIN: 'Institutional management, users, and operations.',
      ADVISOR_MANAGER: 'Supervises advisor network and commissions.',
      ADVISOR: 'Supports investors and manages assigned portfolio.',
      INVESTOR: 'Accesses marketplace and tokenized portfolio.',
      TREASURY: 'Treasury operations and cash flow.',
      OPERATOR: 'Internal platform operations.'
    },
    staffPanelHint: 'Operational panel based on your role permissions.',
    registerTitle: 'Create account',
    registerDesc:
      'Email and phone. After sign-up you verify email and SMS to activate your account.',
    registerButton: 'Create account and continue',
    register: {
      fullNameLabel: 'Full name',
      fullNamePlaceholder: 'As shown on your ID or passport',
      taxIdLabel: 'Tax identification number',
      taxIdPlaceholder: 'CUIT / CUIL / tax ID',
      emailLabel: 'Email',
      emailPlaceholder: 'you@email.com',
      verifiedLabel: 'Verified',
      pendingLabel: 'Pending',
      kycPrefillHint:
        'Full name and tax ID were filled automatically from your Didit verification.',
      profileHint: 'Your account details. Complete verification to operate on the platform.',
      passwordLabel: 'Password',
      passwordPlaceholder: 'At least 8 characters',
      passwordHint: 'Use at least 8 characters. Toggle visibility with the eye icon.',
      phoneLabel: 'Mobile phone',
      phonePlaceholder: '2617513426',
      phoneHint: 'Enter the number without leading 0 or 15. Country code is selected separately.',
      countryLabel: 'Country code',
      submitButton: 'Create account and verify',
      submitting: 'Creating account…',
      flowHint: 'Step 1: sign up · Step 2: email · Step 3: SMS',
      devCodes: 'Verification codes',
      codesOnScreenHint: 'Use these codes in the next steps (email/SMS provider not configured yet):',
      errors: {
        GENERIC: 'We could not create your account. Please try again.',
        EMAIL_IN_USE: 'This email is already registered. Sign in instead.',
        WEAK_PASSWORD: 'Password must be at least 8 characters.',
        INVALID_EMAIL: 'Enter a valid email address (e.g. you@email.com).',
        INVALID_PHONE: 'Enter a valid mobile number with country code.',
        VERIFICATION_DELIVERY_FAILED:
          'We could not send the email and SMS codes. The account was not activated; please try again in a few minutes.',
        SIGN_IN_FAILED: 'Account created, but automatic sign-in failed.'
      }
    },
    kycTitle: 'Identity verification (KYC)',
    kycDesc:
      'Available after email and phone verification. Didit handles identity with document and liveness checks.',
    kycButton: 'Go to onboarding',
    backHome: 'Back to home'
  },
  kyc: {
    title: 'KYC verification',
    description:
      'Integration with Sumsub provider. After automatic approval, the webhook will update your status to verified.',
    simulateButton: 'Simulate KYC approval (demo)',
    cancel: 'Cancel',
    loading: 'Loading KYC…'
  },
  onboarding: {
    eyebrow: 'Mobile onboarding',
    title: 'Activate your account',
    backHome: 'Home',
    backToAccess: 'Back to sign in',
    loading: 'Loading onboarding…',
    continue: 'Continue',
    continuing: 'Processing…',
    devCodes: 'Test codes',
    loginRequiredTitle: 'Sign in to continue',
    loginRequiredDesc: 'Onboarding with ID, email, and phone requires an active session.',
    loginRequiredCta: 'Go to sign in',
    fields: {
      email: 'Email',
      phone: 'Mobile phone',
      phonePlaceholder: '2617513426',
      countryLabel: 'Country code',
      phoneHint: 'Without leading 0 or 15. Example with +54: 2617513426.'
    },
    steps: {
      contactTitle: 'Contact details',
      contactDesc: 'We use your session email and verify your phone via SMS code.',
      emailTitle: 'Verify your email',
      emailDesc: 'Enter the 6-digit code we sent to your inbox.',
      phoneTitle: 'Verify your phone',
      phoneDesc: 'Enter the 6-digit SMS code.',
      identityTitle: 'ID document & liveness',
      identityDesc:
        'Take a photo of your national ID or passport and complete liveness. Didit guides the full flow on mobile.',
      identityDoc: 'ID or passport (clear photo, no glare)',
      identityLiveness: 'Liveness selfie (anti-spoofing)',
      startDidit: 'Open Didit verification',
      diditRedirecting: 'Connecting to Didit…',
      diditRedirectingHint: 'ID or passport and liveness check on your phone.',
      demoKyc: 'Simulate verification (demo only)',
      diditPartner: 'Regulated flow by Didit · 500 free checks/month',
      doneTitle: 'Account operational',
      doneDesc: 'Email, phone, and identity verified. You can now use the marketplace.'
    },
    errors: {
      GENERIC: 'We could not complete this step. Please try again.',
      INVALID_CODE: 'Invalid or expired code.',
      INVALID_PHONE: 'Enter a valid phone number with country code.',
      RATE_LIMIT: 'Too many attempts. Wait a few minutes.',
      VERIFICATION_DELIVERY_FAILED:
        'We could not send the email and SMS codes. Check email/SMS configuration or try again.',
      DIDIT_NOT_CONFIGURED: 'Didit is not configured on the server yet. Contact support.',
      CONTACT_NOT_VERIFIED: 'Verify your email and phone before starting KYC.'
    }
  },
  pwa: {
    installTitle: 'Install Sanova on your phone',
    installDesc: 'Quick app-like access — best for uploading documents and identity checks.',
    installCta: 'Add to home screen',
    dismiss: 'Close'
  },
  cashFlow: {
    eyebrow: 'Cash flow',
    title: 'Cash dividends for margin repayment',
    subtitle:
      'Operating yields are settled strictly in cash to support amortization of investment account liabilities.',
    availableCashLabel: 'Available cash accumulated for repayment',
    coverageLabel: 'Coverage against active debt',
    repayButton: 'Apply to margin repayment',
    repaying: 'Processing repayment…',
    repayError: 'Could not apply margin repayment.',
    totalDistributedLabel: 'Total distributed',
    historyTitle: 'Dividend distribution history',
    colConcept: 'Concept',
    colDate: 'Date',
    colAsset: 'Asset',
    colAmount: 'Amount USD',
    colStatus: 'Status'
  },
  portfolio: {
    title: 'My assets',
    subtitle: 'Consolidated view of your tokenized holdings and on-chain positions.',
    empty: 'You have no active positions yet. Explore the marketplace to invest.',
    comingSoon: 'Detailed portfolio view coming soon. Meanwhile, explore the marketplace or your cash-flow dashboard.'
  },
  status: {
    liquidatedCash: 'Liquidated in cash'
  },
  demo: {
    assets: {
      aneloOps: 'Añelo Operations',
      tolhuin: 'Tolhuin',
      mendoza: 'Mendoza'
    },
    concepts: {
      aneloYield: 'Distributed yield — cash tranche (USDC)',
      aneloAmortization: 'Partial amortization indexed via listener',
      tolhuinDividend: 'Operating RWA dividend liquidated in cash',
      debtServiceCoverage: 'Debt service — covered with operating cash flow',
      mendozaQuarterly: 'Quarterly performance distribution in cash',
      liveDistribution: 'Distribution liquidated in real time (SSE)'
    },
    cashFlowConcepts: {
      tolhuinDividend: 'Operating RWA dividend liquidated in cash',
      mendozaQuarterly: 'Quarterly performance distribution in cash'
    }
  },
  meta: {
    title: 'Sanova Global — Tokenized Real Estate',
    description: 'Invest in tokenized real assets with on-chain rental income and KYC compliance.',
    pwaTitle: 'Sanova RWA'
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
    whatsappLabel: string;
    whatsappMessage: string;
    loadingGeneric: string;
  };
  propertyCard: {
    kycRequired: string;
    readyForCheckout: string;
    placementProgress: string;
    tokenPrice: string;
    tokenSymbolLabel: string;
    estimatedAnnualIncome: string;
    fixedAnnualPayment: string;
    fixedCoupon: string;
    instrumentDebt: string;
    instrumentEquity: string;
    maturity: string;
    equityParticipation: string;
    perToken: string;
    instantLiquidity: string;
    legalContractsBadge: string;
    contractUnavailable: string;
    limitedAvailability: string;
    viewMap: string;
    viewReel: string;
    contracts: {
      button: string;
      title: string;
      subtitle: string;
      trust: string;
      purchase: string;
      lease: string;
      smartContract: string;
    };
  };
  marketplace: {
    title: string;
    subtitle: string;
    brandLabel: string;
    bestBorrowRate: string;
    allBorrowRatesTitle: string;
    allBorrowRatesDesc: string;
    colLender: string;
    colRegion: string;
    colCategory: string;
    colBorrowRate: string;
    bestBadge: string;
    lendingRatesFootnote: string;
    lenderRegions: Record<'global' | 'americas' | 'europe' | 'asia_pacific' | 'mea', string>;
    lenderCategories: Record<'money_market' | 'credit_pool' | 'rwa' | 'institutional', string>;
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
    home: string;
    dashboard: string;
    marketplace: string;
    myAssets: string;
    cashFlow: string;
    signOut: string;
  };
  adminNav: {
    panel: string;
    investors: string;
    assets: string;
    treasury: string;
    team: string;
    settings: string;
    viewMarketplace: string;
  };
  adminDashboard: {
    eyebrow: string;
    sidebarSubtitle: string;
    title: string;
    subtitle: string;
    backToPanel: string;
    comingSoon: string;
    kycAlert: string;
    kpiInvestors: string;
    kpiInvestorsHint: string;
    kpiKycPending: string;
    kpiKycPendingHint: string;
    kpiActiveAssets: string;
    kpiActiveAssetsHint: string;
    kpiCapital: string;
    kpiCapitalHint: string;
    kpiInvestments: string;
    kpiInvestmentsHint: string;
    kpiStaff: string;
    kpiStaffHint: string;
    quickLinksTitle: string;
    quickLinksSubtitle: string;
    investorsDesc: string;
    assetsDesc: string;
    treasuryDesc: string;
    teamDesc: string;
    settingsDesc: string;
  };
  adminInvestors: {
    eyebrow: string;
    filters: {
      ALL: string;
      PENDING: string;
      APPROVED: string;
      REJECTED: string;
    };
    status: {
      PENDING: string;
      APPROVED: string;
      REJECTED: string;
    };
    colInvestor: string;
    colEmail: string;
    colWallet: string;
    colKyc: string;
    colIdentity: string;
    colRegistered: string;
    colActions: string;
    viewIdentity: string;
    hideIdentity: string;
    approve: string;
    reject: string;
    refresh: string;
    loading: string;
    error: string;
    empty: string;
    contactPendingHint: string;
  };
  identityProfile: {
    title: string;
    empty: string;
    fullName: string;
    documentId: string;
    dateOfBirth: string;
    nationality: string;
    documentType: string;
    documentExpiry: string;
    gender: string;
  };
  adminAssets: {
    eyebrow: string;
    filters: {
      ALL: string;
      ACTIVE: string;
      INACTIVE: string;
    };
    status: {
      ACTIVE: string;
      INACTIVE: string;
    };
    colAsset: string;
    colLocation: string;
    colPrice: string;
    colSupply: string;
    colYield: string;
    colStatus: string;
    colActions: string;
    publish: string;
    unpublish: string;
    edit: string;
    cancel: string;
    save: string;
    view: string;
    refresh: string;
    sold: string;
    activeInvestments: string;
    fieldAvailableTokens: string;
    fieldPricePerToken: string;
    loading: string;
    error: string;
    empty: string;
    saveError: string;
    validationTokens: string;
    validationPrice: string;
    newLaunch: string;
    editLaunch: string;
  };
  adminLaunch: {
    eyebrow: string;
    createTitle: string;
    editTitle: string;
    subtitle: string;
    loading: string;
    loadError: string;
    save: string;
    saving: string;
    saveSuccess: string;
    saveError: string;
    sectionBasic: string;
    sectionToken: string;
    sectionMedia: string;
    mediaDesc: string;
    mediaEmpty: string;
    mediaSaved: string;
    uploadVideo: string;
    addReelUrl: string;
    uploadError: string;
    uploadStorageNotConfigured: string;
    uploadUnsupportedType: string;
    uploadTooLarge: string;
    optionalBadge: string;
    sectionContracts: string;
    sectionCollateral: string;
    fieldTitle: string;
    fieldDescription: string;
    fieldLocation: string;
    fieldLatitude: string;
    fieldLongitude: string;
    fieldTotalTokens: string;
    fieldAvailableTokens: string;
    fieldPricePerToken: string;
    fieldInstrumentType: string;
    instrumentTypeDesc: string;
    instrumentDebt: string;
    instrumentDebtDesc: string;
    instrumentEquity: string;
    instrumentEquityDesc: string;
    fieldFixedCoupon: string;
    fieldProjectedYield: string;
    fixedCouponHint: string;
    projectedYieldHint: string;
    fieldMaturityDate: string;
    fieldEquityShare: string;
    equityShareHint: string;
    fieldYield: string;
    fieldTokenName: string;
    fieldTokenSymbol: string;
    fieldTokenStandard: string;
    fieldVaultAddress: string;
    fieldSpvEntity: string;
    fieldNavOracle: string;
    fieldContractAddress: string;
    tokenStandardSanova: string;
    tokenStandardErc4626: string;
    tokenStandardThirdweb: string;
    tokenStandardSanovaDesc: string;
    tokenStandardErc4626Desc: string;
    tokenStandardThirdwebDesc: string;
    sectionCentrifuge: string;
    centrifugeDesc: string;
    centrifugeReadiness: string;
    centrifugeChecklist: {
      spvDocumented: string;
      legalAuditDone: string;
      navOracleConfigured: string;
      kycPolicyActive: string;
      liquidityPlanDocumented: string;
      smartContractVerified: string;
    };
    mapHint: string;
    uploadPhoto: string;
    uploading: string;
    reelPlaceholder: string;
    contractsDesc: string;
    contractLabels: {
      trust: string;
      purchase: string;
      lease: string;
      smartContract: string;
    };
    noFile: string;
    uploadPdf: string;
    collateralDesc: string;
    collateralNote: string;
    registerCollateral: string;
    collateralRegisterSuccess: string;
    collateralRegisterPending: string;
    collateralRegisterError: string;
    collateralMissing: string;
    collateralAutoTriggered: string;
    collateralStatuses: Record<string, string>;
    publishOnSave: string;
    tokenDeployTitle: string;
    tokenDeployDesc: string;
    tokenDeployOptionalHint: string;
    tokenDeployThirdwebHint: string;
    deployToken: string;
    autoDeployOnCreate: string;
    tokenStatus: string;
    tokenSkipped: string;
    tokenDeployed: string;
    tokenRequested: string;
    tokenDeployError: string;
  };
  adminTeam: {
    designateTitle: string;
    designateDesc: string;
    email: string;
    name: string;
    role: string;
    roleAdvisor: string;
    roleManager: string;
    upline: string;
    selectUpline: string;
    designate: string;
    designating: string;
    designateSuccess: string;
    designateError: string;
    advisorsTitle: string;
    membersTitle: string;
    membersDesc: string;
    colFullName: string;
    colIdentification: string;
    colEmail: string;
    colEmailVerified: string;
    colPhone: string;
    colPhoneVerified: string;
    colRole: string;
    colUpline: string;
    colClients: string;
    colDownline: string;
    verificationPending: string;
    loading: string;
    error: string;
    empty: string;
    emptyMembers: string;
    nominationsTitle: string;
    nominationsDesc: string;
    colSuggestedBy: string;
    colStatus: string;
    colDate: string;
    approve: string;
    reject: string;
    pending: string;
    approved: string;
    rejected: string;
    noNominations: string;
    refresh: string;
  };
  adminSettings: {
    loading: string;
    error: string;
    refresh: string;
    save: string;
    saving: string;
    saveSuccess: string;
    saveError: string;
    validationWhatsapp: string;
    validationEmail: string;
    validationSiteUrl: string;
    contactTitle: string;
    contactDesc: string;
    whatsappPhone: string;
    contactEmail: string;
    siteUrl: string;
    sources: {
      database: string;
      environment: string;
      default: string;
    };
    integrationsTitle: string;
    integrationsDesc: string;
    integrations: {
      email: string;
      sms: string;
      kyc: string;
      googleOAuth: string;
      appleOAuth: string;
      walletConnect: string;
      blockchain: string;
      redis: string;
      thirdweb: string;
      supabaseStorage: string;
      collateralWebhook: string;
      centrifuge: string;
      morpho: string;
      maple: string;
      figure: string;
    };
    configured: string;
    notConfigured: string;
    accessTitle: string;
    accessDesc: string;
    adminEmails: string;
    noAdminEmails: string;
    oauthGoogle: string;
    oauthApple: string;
    operationsTitle: string;
    operationsDesc: string;
    nodeEnv: string;
    allowDemoKyc: string;
    bullEnabled: string;
    onboardingDevExposeCode: string;
    enabled: string;
    disabled: string;
    envNote: string;
  };
  adminTreasury: {
    loading: string;
    error: string;
    refresh: string;
    kpiCapital: string;
    kpiCapitalHint: string;
    kpiMarginDebt: string;
    kpiMarginDebtHint: string;
    kpiPayouts: string;
    kpiPayoutsHint: string;
    kpiLiquidPaid: string;
    kpiLiquidPaidHint: string;
    payoutsTitle: string;
    payoutsDesc: string;
    distributionsTitle: string;
    distributionsDesc: string;
    filters: {
      ALL: string;
      PENDING: string;
      SUCCESS: string;
      FAILED: string;
    };
    payoutStatus: {
      PENDING: string;
      SUCCESS: string;
      FAILED: string;
    };
    colProject: string;
    colDate: string;
    colTotal: string;
    colLiquid: string;
    colDebtOffset: string;
    colStatus: string;
    colTx: string;
    colInvestor: string;
    colAsset: string;
    colAmount: string;
    colMarginApplied: string;
    receiptCount: string;
    emptyPayouts: string;
    emptyDistributions: string;
    yes: string;
    no: string;
  };
  advisorPortal: {
    navClients: string;
    navSuggest: string;
    clientsTitle: string;
    clientsDescManager: string;
    clientsDescAdvisor: string;
    readOnlyBadge: string;
    colAdvisor: string;
    suggestTitle: string;
    suggestDesc: string;
    suggestSubmit: string;
    suggestSuccess: string;
    suggestError: string;
    loading: string;
    error: string;
    empty: string;
    emptyHint: string;
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
  landing: {
    nav: {
      howItWorks: string;
      properties: string;
      marketplace: string;
      platformAccess: string;
      enterPlatform: string;
    };
    languageLabel: string;
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      subtitleLead?: string;
      ctaPrimary: string;
      ctaSecondary: string;
      trustLine: string;
    };
    trustBadges: {
      ariaLabel: string;
      labels: readonly string[];
    };
    stats: {
      properties: string;
      investors: string;
      distributed: string;
      avgApy: string;
    };
    operators: {
      title: string;
      subtitle?: string;
    };
    macroThesis: {
      eyebrow: string;
      title: string;
      intro: string;
      mapCaption: string;
      mapFormationLine1: string;
      mapFormationLine2: string;
      mapFormationLine3: string;
      thesisTitle: string;
      thesisDesc: string;
      benefits: readonly string[];
      cta: string;
    };
    howItWorks: {
      title: string;
      subtitle: string;
      step1Title: string;
      step1Desc: string;
      step2Title: string;
      step2Desc: string;
      step3Title: string;
      step3Desc: string;
      step4Title: string;
      step4Desc: string;
    };
    featured: {
      title: string;
      subtitle: string;
      viewAll: string;
      soldPercent: string;
      apyBadge: string;
    };
    benefits: {
      title: string;
      incomeTitle: string;
      incomeDesc: string;
      liquidityTitle: string;
      liquidityDesc: string;
      complianceTitle: string;
      complianceDesc: string;
    };
    cta: {
      title: string;
      subtitle: string;
      button: string;
    };
    footer: {
      tagline: string;
      disclaimer: string;
      rights: string;
      contact: string;
      privacy: string;
      terms: string;
    };
  };
  contact: {
    title: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    submitting: string;
    errorSend: string;
    formNote: string;
    successTitle: string;
    successDesc: string;
    backHome: string;
  };
  access: {
    title: string;
    subtitle: string;
    loginTitle: string;
    loginDesc: string;
    loginButton: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    signInButton: string;
    forgotPassword: string;
    invalidCredentials: string;
    signingIn: string;
    signedInAs: string;
    roleLabel: string;
    continueButton: string;
    sessionActiveTitle: string;
    sessionPendingDesc: string;
    sessionRegisteredDesc: string;
    continueVerification: string;
    switchAccount: string;
    authError: string;
    rolesTitle: string;
    rolesDesc: string;
    roles: Record<
      'ADMIN' | 'ADVISOR_MANAGER' | 'ADVISOR' | 'INVESTOR' | 'TREASURY' | 'OPERATOR',
      string
    >;
    roleDescriptions: Record<
      'ADMIN' | 'ADVISOR_MANAGER' | 'ADVISOR' | 'INVESTOR' | 'TREASURY' | 'OPERATOR',
      string
    >;
    staffPanelHint: string;
    registerTitle: string;
    registerDesc: string;
    registerButton: string;
    register: {
      fullNameLabel: string;
      fullNamePlaceholder: string;
      taxIdLabel: string;
      taxIdPlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      verifiedLabel: string;
      pendingLabel: string;
      kycPrefillHint: string;
      profileHint: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      passwordHint: string;
      phoneLabel: string;
      phonePlaceholder: string;
      phoneHint: string;
      countryLabel: string;
      submitButton: string;
      submitting: string;
      flowHint: string;
      devCodes: string;
      codesOnScreenHint: string;
      errors: {
        GENERIC: string;
        EMAIL_IN_USE: string;
        WEAK_PASSWORD: string;
        INVALID_EMAIL: string;
        INVALID_PHONE: string;
        VERIFICATION_DELIVERY_FAILED: string;
        SIGN_IN_FAILED: string;
      };
    };
    kycTitle: string;
    kycDesc: string;
    kycButton: string;
    backHome: string;
  };
  kyc: {
    title: string;
    description: string;
    simulateButton: string;
    cancel: string;
    loading: string;
  };
  onboarding: {
    eyebrow: string;
    title: string;
    backHome: string;
    backToAccess: string;
    loading: string;
    continue: string;
    continuing: string;
    devCodes: string;
    loginRequiredTitle: string;
    loginRequiredDesc: string;
    loginRequiredCta: string;
    fields: {
      email: string;
      phone: string;
      phonePlaceholder: string;
      countryLabel: string;
      phoneHint: string;
    };
    steps: {
      contactTitle: string;
      contactDesc: string;
      emailTitle: string;
      emailDesc: string;
      phoneTitle: string;
      phoneDesc: string;
      identityTitle: string;
      identityDesc: string;
      identityDoc: string;
      identityLiveness: string;
      startDidit: string;
      diditRedirecting: string;
      diditRedirectingHint: string;
      demoKyc: string;
      diditPartner: string;
      doneTitle: string;
      doneDesc: string;
    };
    errors: {
      GENERIC: string;
      INVALID_CODE: string;
      INVALID_PHONE: string;
      RATE_LIMIT: string;
      VERIFICATION_DELIVERY_FAILED: string;
      DIDIT_NOT_CONFIGURED: string;
      CONTACT_NOT_VERIFIED: string;
    };
  };
  pwa: {
    installTitle: string;
    installDesc: string;
    installCta: string;
    dismiss: string;
  };
  cashFlow: {
    eyebrow: string;
    title: string;
    subtitle: string;
    availableCashLabel: string;
    coverageLabel: string;
    repayButton: string;
    repaying: string;
    repayError: string;
    totalDistributedLabel: string;
    historyTitle: string;
    colConcept: string;
    colDate: string;
    colAsset: string;
    colAmount: string;
    colStatus: string;
  };
  portfolio: {
    title: string;
    subtitle: string;
    empty: string;
    comingSoon: string;
  };
  status: {
    liquidatedCash: string;
  };
  demo: {
    assets: {
      aneloOps: string;
      tolhuin: string;
      mendoza: string;
    };
    concepts: {
      aneloYield: string;
      aneloAmortization: string;
      tolhuinDividend: string;
      debtServiceCoverage: string;
      mendozaQuarterly: string;
      liveDistribution: string;
    };
    cashFlowConcepts: {
      tolhuinDividend: string;
      mendozaQuarterly: string;
    };
  };
  meta: {
    title: string;
    description: string;
    pwaTitle: string;
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
