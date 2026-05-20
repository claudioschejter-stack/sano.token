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
