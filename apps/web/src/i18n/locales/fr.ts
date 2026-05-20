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
    backToMarketplace: 'Retour au marketplace',
    whatsappLabel: 'Chat with us on WhatsApp',
    whatsappMessage: 'Hello, I am contacting you from the Sanova Global website.'
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
    home: 'Accueil',
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
  landing: {
    nav: {
      howItWorks: 'How it works',
      properties: 'Properties',
      marketplace: 'Marketplace',
      platformAccess: 'Accès plateforme'
    },
    languageLabel: 'Langue',
    hero: {
      eyebrow: 'Tokenized real estate',
      title: 'Own fractional real assets.\nEarn rental income on-chain.',
      subtitle:
        'Sanova Global connecte des investisseurs vérifiés à des propriétés productives à Vaca Muerta, Neuquén, Argentine — pôle mondial du shale oil & gas non conventionnel, deuxième réserve de gaz mondiale, infrastructures de classe mondiale, coûts opérationnels très compétitifs et immense potentiel de production pétrolière et gazière — plus rendements transparents, conformité KYC et règlement instantané.',
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
      title: 'Opèrent actuellement à Vaca Muerta'
    },
    macroThesis: {
      eyebrow: 'Macro Context & Investment Thesis',
      title: 'Vaca Muerta: The Global Energy Epicenter',
      intro:
        'Located in Argentine Patagonia, Vaca Muerta is not an exploratory promise — it is the fastest-growing unconventional shale play outside North America. The world\'s leading energy operators are already scaling production, consolidating a historic flow of institutional capital.',
      mapCaptionLead: 'Vaca Muerta, Argentina',
      mapCaptionDetail: '30,000 km² (Surface area comparable to Belgium)',
      stat1Value: '2nd',
      stat1Label: 'Global Shale Gas Reserves',
      stat2Value: '4th',
      stat2Label: 'Global Shale Oil Reserves',
      stat3Value: '+US$ 9B',
      stat3Label: 'Projected Annual Investment',
      thesisTitle: 'The Infrastructure Gap: The Real Opportunity',
      thesisDesc:
        'The basin\'s rapid development has far outpaced local infrastructure capacity. Añelo, the operational hub, faces a critical shortage of hotel rooms, corporate centers, and logistics services. We provide the prime infrastructure multinationals need to operate. This inelastic corporate demand generates capitalization rates significantly above traditional real estate markets.'
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
      soldPercent: '{percent}% placé',
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
      tagline: 'RWA · Immobilier tokenisé',
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
    title: 'Accès à la plateforme',
    subtitle: 'Connectez-vous ou inscrivez-vous et complétez le KYC pour investir.',
    loginTitle: 'Connexion',
    loginDesc: 'Accédez au marketplace et à votre portefeuille avec un compte vérifié.',
    loginButton: 'Aller au marketplace',
    registerTitle: 'Créer un compte',
    registerDesc: 'Inscription investisseur. KYC requis avant le premier achat.',
    registerButton: "S'inscrire et démarrer le KYC",
    kycTitle: 'Vérification d\'identité (KYC)',
    kycDesc: 'Conformité réglementaire via notre partenaire d\'onboarding.',
    kycButton: 'Continuer vers KYC',
    backHome: "Retour à l'accueil"
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
