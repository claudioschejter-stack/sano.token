import { mergeLocale } from './mergeLocale';

export const sw = mergeLocale({
  brand: { portalSubtitle: 'Portal ya RWA' },
  common: {
    investNow: 'Wekeza sasa',
    backToMarketplace: 'Rudi kwenye soko',
    projectedApy: 'APY inayotarajiwa'
  },
  nav: {
    home: 'Nyumbani',
    language: 'Lugha',
    marketplace: 'Soko',
    dashboard: 'Dashibodi'
  },
  landing: {
    languageLabel: 'Lugha',
    nav: {
      howItWorks: 'Jinsi inavyofanya kazi',
      properties: 'Mali',
      marketplace: 'Soko',
      platformAccess: 'Ufikiaji wa jukwaa'
    },
    hero: {
      eyebrow: 'Mali isiyohamishika iliyobadilishwa token',
      title: 'Umiliki mali halisi za sehemu.\nPata mapato ya kodi on-chain.',
      subtitle:
        'Sanova Global inaunganisha wawekezaji waliohakikiwa na mali za uzalishaji katika Vaca Muerta, Neuquén, Argentina — kitovu cha dunia cha shale oil & gas visivyo vya kawaida, akiba ya pili kubwa ya gesi duniani, miundombinu ya kiwango cha dunia, gharama za uendeshaji zenye ushindani, na uwezo mkubwa wa uzalishaji wa mafuta na gesi — pamoja na faida wazi, utii wa KYC na malipo ya papo hapo.',
      ctaPrimary: 'Tazama mali',
      ctaSecondary: 'Jinsi inavyofanya kazi',
      trustLine: 'Mifumo ya udhibiti · KYC/AML · Mgawanyo on-chain kwa USDC'
    },
    stats: {
      properties: 'Matoleo hai',
      investors: 'Wawekezaji waliohakikiwa',
      distributed: 'USDC yaliyogawanywa',
      avgApy: 'Wastani wa APY inayotarajiwa'
    },
    howItWorks: {
      title: 'Wekeza kwa hatua 3',
      subtitle: 'Kutoka ugunduzi hadi umiliki on-chain — kwa wawekezaji wa rejareja na taasisi.',
      step1Title: 'Kamilisha KYC',
      step1Desc: 'Thibitisha utambulisho mara moja. Sanova inafanya kazi na watoa huduma waliodhibitiwa.',
      step2Title: 'Chagua mali',
      step2Desc: 'Vinjari mali zilizobadilishwa token na mfumo wa kodi, APY na maendeleo ya uwekaji.',
      step3Title: 'Pokea mgawanyo',
      step3Desc: 'Mapato ya kodi yanafika kwenye pochi yako kwa USDC. Fuatilia kwenye portal.'
    },
    featured: {
      title: 'Mali zilizoangaziwa',
      subtitle: 'Mali halisi zenye uchumi wa token uwazi.',
      viewAll: 'Tazama orodha zote',
      soldPercent: '{percent}% imeuzwa',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Kwa nini Sanova RWA',
      incomeTitle: 'Mapato ya kodi yanayorudiwa',
      incomeDesc: 'Mgawanyo wa kila mwezi kutoka kwa mtiririko wa pesa wa uendeshaji, on-chain.',
      liquidityTitle: 'Ukwasi uliopangwa',
      liquidityDesc: 'Utoke kupitia hazina ya SanovaAMM au soko la sekondari.',
      complianceTitle: 'Utii kwanza',
      complianceDesc: 'KYC, ufichuzi wa kodi na rekodi on-chain zinazoweza kukaguliwa.'
    },
    cta: {
      title: 'Anza kwingineko yako ya mali halisi',
      subtitle: 'Fikia mali isiyohamishika iliyobadilishwa token kiwango cha taasisi.',
      button: 'Fungua soko'
    },
    footer: {
      tagline: 'RWA · Mali isiyohamishika token',
      disclaimer:
        'Tovuti hii ni kwa habari tu na si ofa ya kuuza au ombi la kununua dhamana. Utendaji wa zamani hauhakikishi matokeo ya baadaye.',
      rights: '© 2019–2026 Sanova Global. Haki zote zimehifadhiwa.',
      privacy: 'Faragha',
      terms: 'Masharti'
    }
  },
  access: {
    title: 'Ufikiaji wa jukwaa',
    subtitle: 'Ingia ikiwa una akaunti, au jisajili na kamilisha KYC ili kuwekeza.',
    loginTitle: 'Ingia',
    loginDesc: 'Fikia soko na kwingineko yako kwa akaunti iliyothibitishwa na pochi.',
    loginButton: 'Nenda kwenye soko',
    registerTitle: 'Unda akaunti',
    registerDesc: 'Jisajili kama mwekezaji mpya. KYC inahitajika kabla ya ununuzi wa kwanza.',
    registerButton: 'Jisajili na anza KYC',
    kycTitle: 'Uthibitishaji wa utambulisho (KYC)',
    kycDesc: 'Utii wa udhibiti unahitaji uthibitishaji wa utambulisho.',
    kycButton: 'Endelea kwa KYC',
    backHome: 'Rudi nyumbani'
  }
});
