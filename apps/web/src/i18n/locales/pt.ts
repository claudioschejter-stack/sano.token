import { mergeLocale } from './mergeLocale';

export const pt = mergeLocale({
  brand: { portalSubtitle: 'Portal RWA' },
  common: {
    investNow: 'Investir agora',
    backToMarketplace: 'Voltar ao marketplace',
    projectedApy: 'APY projetado'
  },
  nav: {
    home: 'Início',
    language: 'Idioma',
    marketplace: 'Marketplace',
    dashboard: 'Painel'
  },
  landing: {
    languageLabel: 'Idioma',
    nav: {
      howItWorks: 'Como funciona',
      properties: 'Propriedades',
      marketplace: 'Marketplace',
      platformAccess: 'Acesso à plataforma'
    },
    hero: {
      eyebrow: 'Imóveis tokenizados',
      title: 'Possua ativos reais fracionados.\nReceba renda de aluguel on-chain.',
      subtitle:
        'A Sanova Global conecta investidores verificados a propriedades produtivas em Vaca Muerta, Neuquén, Argentina — principal polo global de shale oil & gas não convencional, com a segunda maior reserva de gás do mundo, infraestrutura de classe mundial, custos operacionais altamente competitivos e enorme potencial de produção de petróleo e gás — além de rendimentos transparentes, conformidade KYC e liquidação instantânea.',
      ctaPrimary: 'Ver propriedades',
      ctaSecondary: 'Como funciona',
      trustLine: 'Marcos regulatórios · KYC/AML · Distribuições on-chain em USDC'
    },
    stats: {
      properties: 'Ofertas ativas',
      investors: 'Investidores verificados',
      distributed: 'USDC distribuídos',
      avgApy: 'APY médio projetado'
    },
    howItWorks: {
      title: 'Invista em três passos',
      subtitle: 'Da descoberta à propriedade on-chain — para investidores de varejo e institucionais.',
      step1Title: 'Complete o KYC',
      step1Desc: 'Verifique sua identidade uma vez. A Sanova integra provedores regulados.',
      step2Title: 'Escolha um imóvel',
      step2Desc: 'Explore ativos tokenizados com regime fiscal, APY e progresso de colocação.',
      step3Title: 'Receba distribuições',
      step3Desc: 'A renda de aluguel chega à sua carteira em USDC. Acompanhe no portal.',
    },
    featured: {
      title: 'Propriedades em destaque',
      subtitle: 'Ativos do mundo real com economia de tokens transparente.',
      viewAll: 'Ver todos os anúncios',
      soldPercent: '{percent}% colocado',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Por que Sanova RWA',
      incomeTitle: 'Renda recorrente',
      incomeDesc: 'Distribuições mensais do fluxo operacional, liquidadas on-chain.',
      liquidityTitle: 'Liquidez programada',
      liquidityDesc: 'Saída via tesouraria SanovaAMM ou mercado secundário.',
      complianceTitle: 'Conformidade em primeiro lugar',
      complianceDesc: 'KYC, divulgação fiscal e registros on-chain auditáveis.'
    },
    cta: {
      title: 'Comece seu portfólio de ativos reais',
      subtitle: 'Acesse imóveis tokenizados com padrão institucional.',
      button: 'Abrir marketplace'
    },
    footer: {
      tagline: 'RWA · Imóveis tokenizados',
      disclaimer:
        'Este site é informativo e não constitui oferta de venda ou solicitação de compra de valores mobiliários. Desempenho passado não garante resultados futuros.',
      rights: '© 2019–2026 Sanova Global. Todos os direitos reservados.',
      privacy: 'Privacidade',
      terms: 'Termos'
    }
  },
  access: {
    title: 'Acesso à plataforma',
    subtitle: 'Entre se já tem conta, ou registre-se e complete o KYC para investir.',
    loginTitle: 'Entrar',
    loginDesc: 'Acesse o marketplace e seu portfólio com conta verificada e carteira conectada.',
    loginButton: 'Ir ao marketplace',
    registerTitle: 'Criar conta',
    registerDesc: 'Registre-se como novo investidor. KYC obrigatório antes da primeira compra.',
    registerButton: 'Registrar e iniciar KYC',
    kycTitle: 'Verificação de identidade (KYC)',
    kycDesc: 'A conformidade regulatória exige verificação de identidade via nosso parceiro.',
    kycButton: 'Continuar para KYC',
    backHome: 'Voltar ao início'
  }
});
