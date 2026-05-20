import type { Messages } from './en';

export const fr: Messages = {
  brand: {
    portalSubtitle: 'Portail RWA'
  },
  common: {
    buyNow: 'Acheter maintenant',
    investNow: 'Investir maintenant',
    reserveTokens: 'Réserver des tokens',
    completeKyc: 'Compléter le KYC',
    projectedApy: 'APY projeté',
    location: 'Emplacement',
    backToMarketplace: 'Retour au marketplace'
  },
  propertyCard: {
    kycRequired: "Vérification d'identité requise avant l'achat.",
    readyForCheckout: 'Vous êtes vérifié. Passez au checkout Web3.',
    placementProgress: 'Progression du placement',
    tokenPrice: 'Prix / token',
    estimatedAnnualIncome: 'Revenu annuel estimé',
    perToken: 'token',
    instantLiquidity: 'Sortie instantanée via trésorerie (−3 % SanovaAMM)',
    limitedAvailability: 'Disponibilité limitée',
    viewMap: 'Voir sur la carte'
  },
  marketplace: {
    title: 'Marketplace RWA',
    subtitle:
      'Actifs réels tokenisés avec liquidité immédiate et taux de prêt compétitifs.',
    brandLabel: 'Sanova RWA',
    bestBorrowRate: "Meilleur taux d'emprunt",
    tokensAvailable: 'tokens disponibles',
    loading: 'Chargement des offres…',
    empty: 'Aucune annonce active pour le moment.',
    error: 'Impossible de charger les données en direct. Affichage des annonces démo.',
    lendingBanner: 'Agrégé depuis Aave, Compound et Maker',
    syncing: 'Synchronisation des données en direct…',
    trustKyc: 'Investisseurs vérifiés KYC',
    trustRegulation: 'Régime fiscal communiqué',
    trustOnchain: 'Règlement on-chain'
  },
  nav: {
    language: 'Langue',
    dashboard: 'Tableau de bord',
    marketplace: 'Marketplace',
    myAssets: 'Mes actifs',
    cashFlow: 'Flux de trésorerie',
    signOut: 'Déconnexion'
  },
  checkout: {
    notFound: 'Projet introuvable.',
    title: 'Paiement',
    kycReady: 'KYC approuvé · prêt à signer on-chain',
    tokenQuantity: 'Quantité de tokens',
    lessTokens: 'Moins de tokens',
    moreTokens: 'Plus de tokens',
    maxAvailable: 'Max. {count} disponibles',
    pricePerToken: 'Prix par token',
    subtotal: 'Sous-total ({count} tokens)',
    total: 'Total ({currency})',
    requestSent: 'Demande envoyée — vérifiez votre portefeuille',
    signing: 'Signature de la transaction…',
    confirmPurchase: "Confirmer l'achat on-chain",
    connectToContinue: 'Connectez votre portefeuille pour continuer'
  },
  wallet: {
    disconnect: 'Déconnecter',
    connecting: 'Connexion…',
    connect: 'Connecter le portefeuille (MetaMask / injected)',
    noWallet: 'Installez MetaMask ou un portefeuille compatible avec le navigateur.'
  },
  dashboard: {
    eyebrow: 'Capital et couverture',
    title: 'Sanova Global SAS — Analytique de portefeuille',
    subtitle:
      'Suivi institutionnel des flux de trésorerie, de la couverture de dette et de la performance des actifs tokenisés.',
    kpiDividends: 'Dividendes en cash reçus (USDC)',
    kpiDividendsHint: 'Total réglé via listener on-chain',
    kpiDebtCoverage: 'Couverture de dette active',
    kpiDebtCoverageHint: "% d'amortissement couvert face au passif en cours",
    kpiAneloYield: 'Rendement opérations Añelo',
    kpiAneloYieldHint: "Rendement projeté sur la NAV de l'actif physique",
    chartTitle: 'Flux mensuel : dividendes vs. service de la dette',
    chartSubtitle: 'Revenus de dividendes liquidés vs. service de la dette programmé.',
    chartCurrency: 'USDC / USD — vue consolidée',
    chartDividends: 'Revenus de dividendes',
    chartDebt: 'Service de la dette',
    distributionsTitle: 'Dernières distributions liquidées',
    distributionsSubtitle: 'Événements indexés par le listener blockchain — tranche cash en USDC.',
    colDate: 'Date',
    colAsset: 'Actif',
    colConcept: 'Concept',
    colAmount: 'Montant USDC',
    colStatus: 'Statut',
    colTx: 'Tx',
    syncing: 'Synchronisation des distributions…',
    empty: 'Aucune distribution liquidée enregistrée.',
    liveDividend: 'Dividende en direct reçu'
  },
  chart: {
    unavailable: 'Graphique indisponible',
    unavailableHint: 'Le reste du tableau de bord reste opérationnel. Rechargez la page pour réessayer.'
  },
  error: {
    eyebrow: 'Une erreur est survenue',
    title: 'Impossible de charger cette vue',
    fallback: 'Erreur temporaire du portail. Retournez au marketplace ou réessayez.',
    retry: 'Réessayer',
    goMarketplace: 'Aller au marketplace',
    globalTitle: 'Erreur inattendue',
    globalHint: 'Une erreur applicative est survenue. Votre session et vos données sont protégées.'
  }
};
