import type { Messages } from './en';

export const de: Messages = {
  brand: {
    portalSubtitle: 'RWA-Portal'
  },
  common: {
    buyNow: 'Jetzt kaufen',
    investNow: 'Jetzt investieren',
    reserveTokens: 'Tokens reservieren',
    completeKyc: 'KYC abschließen',
    projectedApy: 'Prognostizierte APY',
    location: 'Standort',
    backToMarketplace: 'Zurück zum Marketplace'
  },
  propertyCard: {
    kycRequired: 'Vor dem Kauf ist eine Identitätsprüfung erforderlich.',
    readyForCheckout: 'Sie sind verifiziert. Weiter zum Web3-Checkout.',
    placementProgress: 'Platzierungsfortschritt',
    tokenPrice: 'Preis / Token',
    estimatedAnnualIncome: 'Geschätztes Jahreseinkommen',
    perToken: 'Token',
    instantLiquidity: 'Sofortiger Ausstieg über Treasury (−3 % SanovaAMM)',
    limitedAvailability: 'Begrenzte Verfügbarkeit',
    viewMap: 'Auf Karte anzeigen'
  },
  marketplace: {
    title: 'RWA-Marktplatz',
    subtitle: 'Tokenisierte Realvermögen mit sofortiger Liquidität und wettbewerbsfähigen Kreditraten.',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: 'Bester Kreditrate',
    tokensAvailable: 'Tokens verfügbar',
    loading: 'Angebote werden geladen…',
    empty: 'Derzeit keine aktiven Listings.',
    error: 'Live-Daten konnten nicht geladen werden. Demo-Listings werden angezeigt.',
    lendingBanner: 'Aggregiert von Aave, Compound und Maker',
    syncing: 'Live-Daten werden synchronisiert…',
    trustKyc: 'KYC-verifizierte Investoren',
    trustRegulation: 'Steuerregime offengelegt',
    trustOnchain: 'On-Chain-Abwicklung'
  },
  nav: {
    language: 'Sprache',
    home: 'Home',
    dashboard: 'Dashboard',
    marketplace: 'Marketplace',
    myAssets: 'Meine Vermögenswerte',
    cashFlow: 'Cashflow',
    signOut: 'Abmelden'
  },
  checkout: {
    notFound: 'Projekt nicht gefunden.',
    title: 'Checkout',
    kycReady: 'KYC genehmigt · bereit für On-Chain-Signatur',
    tokenQuantity: 'Token-Anzahl',
    lessTokens: 'Weniger Tokens',
    moreTokens: 'Mehr Tokens',
    maxAvailable: 'Max. {count} verfügbar',
    pricePerToken: 'Preis pro Token',
    subtotal: 'Zwischensumme ({count} Tokens)',
    total: 'Gesamt ({currency})',
    requestSent: 'Anfrage gesendet — Wallet prüfen',
    signing: 'Transaktion wird signiert…',
    confirmPurchase: 'On-Chain-Kauf bestätigen',
    connectToContinue: 'Wallet verbinden, um fortzufahren'
  },
  wallet: {
    disconnect: 'Trennen',
    connecting: 'Verbinden…',
    connect: 'Wallet verbinden (MetaMask / injected)',
    noWallet: 'Installieren Sie MetaMask oder eine kompatible Browser-Wallet.'
  },
  dashboard: {
    eyebrow: 'Kapital & Deckung',
    title: 'Sanova Global SAS — Portfolio-Analytik',
    subtitle:
      'Institutionelles Tracking von Cashflow, Schuldendeckung und Performance tokenisierter Sachwerte.',
    kpiDividends: 'Erhaltene Cash-Dividenden (USDC)',
    kpiDividendsHint: 'Abgerechnete Summe via On-Chain-Listener',
    kpiDebtCoverage: 'Aktive Schuldendeckung',
    kpiDebtCoverageHint: '% Tilgung gedeckt gegen laufende Verbindlichkeiten',
    kpiAneloYield: 'Añelo-Betriebsrendite',
    kpiAneloYieldHint: 'Prognostizierte Rendite auf Sachwert-NAV',
    chartTitle: 'Monatlicher Fluss: Dividenden vs. Schuldendienst',
    chartSubtitle: 'Liquidierte Dividenden vs. geplanter Schuldendienst.',
    chartCurrency: 'USDC / USD — konsolidierte Ansicht',
    chartDividends: 'Dividendenerträge',
    chartDebt: 'Schuldendienst',
    distributionsTitle: 'Letzte liquidierte Ausschüttungen',
    distributionsSubtitle: 'Vom Blockchain-Listener indexierte Ereignisse — Cash-Tranche in USDC.',
    colDate: 'Datum',
    colAsset: 'Vermögenswert',
    colConcept: 'Konzept',
    colAmount: 'Betrag USDC',
    colStatus: 'Status',
    colTx: 'Tx',
    syncing: 'Ausschüttungen werden synchronisiert…',
    empty: 'Keine liquidierten Ausschüttungen erfasst.',
    liveDividend: 'Live-Dividende erhalten'
  },
  chart: {
    unavailable: 'Diagramm nicht verfügbar',
    unavailableHint: 'Der Rest des Dashboards bleibt funktionsfähig. Seite neu laden, um es erneut zu versuchen.'
  },
  landing: {
    nav: {
      howItWorks: 'How it works',
      properties: 'Properties',
      marketplace: 'Marketplace',
      platformAccess: 'Plattformzugang'
    },
    languageLabel: 'Sprache',
    hero: {
      eyebrow: 'Tokenized real estate',
      title: 'Own fractional real assets.\nEarn rental income on-chain.',
      subtitle:
        'Sanova Global verbindet verifizierte Investoren mit produktiven Immobilien in Vaca Muerta, Neuquén, Argentinien — globales Zentrum für unkonventionelles Shale-Öl & -Gas, zweitgrößte Gasreserven der Welt, erstklassige Infrastruktur, wettbewerbsfähige Betriebskosten und enormes Öl- und Gasproduktionspotenzial — plus transparenter Rendite, KYC-Compliance und sofortiger Abwicklung.',
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
      title: 'Derzeit in Vaca Muerta tätig'
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
      soldPercent: '{percent}% platziert',
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
      tagline: 'RWA · Tokenisierte Immobilien',
      disclaimer:
        'This site is for informational purposes only and does not constitute an offer to sell securities.',
      rights: '© 2019–2026 Sanova Global. All rights reserved.',
      privacy: 'Privacy',
      terms: 'Terms'
    }
  },
  access: {
    title: 'Plattformzugang',
    subtitle: 'Melden Sie sich an oder registrieren Sie sich und schließen Sie KYC ab, um zu investieren.',
    loginTitle: 'Anmelden',
    loginDesc: 'Zugang zum Marketplace und Portfolio mit verifiziertem Konto und Wallet.',
    loginButton: 'Zum Marketplace',
    registerTitle: 'Konto erstellen',
    registerDesc: 'Als neuer Investor registrieren. KYC ist vor dem ersten Kauf erforderlich.',
    registerButton: 'Registrieren & KYC starten',
    kycTitle: 'Identitätsprüfung (KYC)',
    kycDesc: 'Regulatorische Compliance erfordert eine Identitätsprüfung über unseren Partner.',
    kycButton: 'Weiter zu KYC',
    backHome: 'Zur Startseite'
  },
  error: {
    eyebrow: 'Etwas ist schiefgelaufen',
    title: 'Diese Ansicht konnte nicht geladen werden',
    fallback: 'Vorübergehender Portalfehler. Zum Marketplace zurückkehren oder erneut versuchen.',
    retry: 'Erneut versuchen',
    goMarketplace: 'Zum Marketplace',
    globalTitle: 'Unerwarteter Fehler',
    globalHint: 'Ein Anwendungsfehler ist aufgetreten. Ihre Sitzung und Daten sind geschützt.'
  }
};
