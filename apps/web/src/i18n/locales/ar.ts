import { mergeLocale } from './mergeLocale';

export const ar = mergeLocale({
  brand: { portalSubtitle: 'بوابة RWA' },
  common: {
    investNow: 'استثمر الآن',
    backToMarketplace: 'العودة إلى السوق',
    projectedApy: 'APY المتوقع'
  },
  nav: {
    home: 'الرئيسية',
    language: 'اللغة',
    marketplace: 'السوق',
    dashboard: 'لوحة التحكم'
  },
  landing: {
    languageLabel: 'اللغة',
    nav: {
      howItWorks: 'كيف يعمل',
      properties: 'العقارات',
      marketplace: 'السوق',
      platformAccess: 'الوصول إلى المنصة'
    },
    hero: {
      eyebrow: 'عقارات مرمّزة',
      title: 'امتلك أصولاً حقيقية جزئية.\nاكسب دخل الإيجار على السلسلة.',
      subtitle:
        'تربط Sanova Global مستثمرين موثّقين بعقارات منتجة في فاكا مويرتا، نيوكوين، الأرجنتين — مركز عالمي للنفط والغاز الصخري غير التقليدي، ثاني أكبر احتياطي غاز في العالم، بنية تحتية عالمية، تكاليف تشغيل تنافسية وإمكانات هائلة لإنتاج النفط والغاز — بالإضافة إلى عوائد شفافة وامتثال KYC وتسوية فورية.',
      ctaPrimary: 'تصفح العقارات',
      ctaSecondary: 'كيف يعمل',
      trustLine: 'أطر تنظيمية · KYC/AML · توزيعات على السلسلة بـ USDC'
    },
    stats: {
      properties: 'عروض نشطة',
      investors: 'مستثمرون موثّقون',
      distributed: 'USDC موزّع',
      avgApy: 'متوسط APY المتوقع'
    },
    howItWorks: {
      title: 'استثمر في ثلاث خطوات',
      subtitle: 'من الاكتشاف إلى الملكية على السلسلة — للمستثمرين الأفراد والمؤسسات.',
      step1Title: 'أكمل KYC',
      step1Desc: 'تحقق من هويتك مرة واحدة. تعمل Sanova مع مزودي onboarding منظمين.',
      step2Title: 'اختر عقاراً',
      step2Desc: 'تصفح أصولاً مرمّزة مع نظام ضريبي وAPY وتقدم الطرح.',
      step3Title: 'استلم التوزيعات',
      step3Desc: 'يصل دخل الإيجار إلى محفظتك بـ USDC. تتبع في بوابة المستثمر.'
    },
    featured: {
      title: 'عقارات مميزة',
      subtitle: 'أصول حقيقية باقتصاد رموز شفاف.',
      viewAll: 'عرض كل القوائم',
      soldPercent: '{percent}% مباع',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'لماذا Sanova RWA',
      incomeTitle: 'دخل إيجار متكرر',
      incomeDesc: 'توزيعات شهرية من التدفق التشغيلي، تسوية على السلسلة.',
      liquidityTitle: 'سيولة مبرمجة',
      liquidityDesc: 'خروج عبر خزينة SanovaAMM أو السوق الثانوي.',
      complianceTitle: 'الامتثال أولاً',
      complianceDesc: 'KYC وإفصاح ضريبي وسجلات على السلسلة قابلة للتدقيق.'
    },
    cta: {
      title: 'ابنِ محفظة أصول حقيقية',
      subtitle: 'انضم لمستثمرين يصلون إلى عقارات مرمّزة بمعايير مؤسسية.',
      button: 'افتح السوق'
    },
    footer: {
      tagline: 'RWA · عقارات مرمّزة',
      disclaimer:
        'هذا الموقع لأغراض إعلامية فقط ولا يشكل عرض بيع أو طلب شراء أوراق مالية. الأداء السابق لا يضمن النتائج المستقبلية.',
      rights: '© 2019–2026 Sanova Global. جميع الحقوق محفوظة.',
      privacy: 'الخصوصية',
      terms: 'الشروط'
    }
  },
  access: {
    title: 'الوصول إلى المنصة',
    subtitle: 'سجّل الدخول إن كان لديك حساب، أو سجّل وأكمل KYC للاستثمار.',
    loginTitle: 'تسجيل الدخول',
    loginDesc: 'الوصول إلى السوق ومحفظتك بحساب موثّق ومحفظة متصلة.',
    loginButton: 'الذهاب إلى السوق',
    registerTitle: 'إنشاء حساب',
    registerDesc: 'التسجيل كمستثمر جديد. KYC مطلوب قبل أول عملية شراء.',
    registerButton: 'التسجيل وبدء KYC',
    kycTitle: 'التحقق من الهوية (KYC)',
    kycDesc: 'يتطلب الامتثال التنظيمي التحقق من الهوية عبر شريكنا.',
    kycButton: 'متابعة إلى KYC',
    backHome: 'العودة للرئيسية'
  }
});
