import { mergeLocale } from './mergeLocale';

export const mr = mergeLocale({
  brand: { portalSubtitle: 'RWA पोर्टल' },
  common: {
    investNow: 'आता गुंतवणू करा',
    backToMarketplace: 'मार्केटप्लेसवर परत',
    projectedApy: 'अंदाजे APY'
  },
  nav: {
    home: 'मुख्यपृष्ठ',
    language: 'भाषा',
    marketplace: 'मार्केटप्लेस',
    dashboard: 'डॅशबोर्ड'
  },
  landing: {
    languageLabel: 'भाषा',
    nav: {
      howItWorks: 'कसे कार्य करते',
      properties: 'मालमत्ता',
      marketplace: 'मार्केटप्लेस',
      platformAccess: 'प्लॅटफॉर्म प्रवेश'
    },
    hero: {
      eyebrow: 'टोकनाइज्ड रिअल इस्टेट',
      title: 'अंशतः वास्तविक मालमत्तेचे मालक व्हा.\nऑन-चेन भाडे उत्पन्न मिळवा.',
      subtitle:
        'Sanova Global सत्यापित गुंतवणूकदारांना लॅटिन अमेरिकेतील उत्पन्न देणाऱ्या मालमत्तांशी जोडते — पारदर्शक परतावा, KYC अनुपालन.',
      ctaPrimary: 'मालमत्ता पहा',
      ctaSecondary: 'कसे कार्य करते',
      trustLine: 'नियमन चौकट · KYC/AML · USDC ऑन-चेन वितरण'
    },
    stats: {
      properties: 'सक्रिय ऑफर',
      investors: 'सत्यापित गुंतवणूकदार',
      distributed: 'वितरित USDC',
      avgApy: 'सरासरी अंदाजे APY'
    },
    howItWorks: {
      title: 'तीन पायऱ्यांमध्ये गुंतवणूक',
      subtitle: 'शोधापासून ऑन-चेन मालकीपर्यंत — किरकोळ आणि संस्थात्मक गुंतवणूकदारांसाठी.',
      step1Title: 'KYC पूर्ण करा',
      step1Desc: 'एकदा ओळख सत्यापित करा. Sanova नियमनबद्ध ऑनबोर्डिंग भागीदारांसोबत काम करते.',
      step2Title: 'मालमत्ता निवडा',
      step2Desc: 'कर व्यवस्था, APY आणि प्लेसमेंट प्रगतीसह टोकनाइज्ड मालमत्ता पहा.',
      step3Title: 'वितरण मिळवा',
      step3Desc: 'भाडे उत्पन्न USDC मध्ये तुमच्या वॉलेटमध्ये येते. पोर्टलमध्ये ट्रॅक करा.'
    },
    featured: {
      title: 'वैशिष्ट्यीकृत मालमत्ता',
      subtitle: 'पारदर्शक टोकन अर्थशास्त्रासह वास्तविक मालमत्ता.',
      viewAll: 'सर्व लिस्टिंग पहा',
      soldPercent: '{percent}% विकले',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Sanova RWA का',
      incomeTitle: 'आवर्ती भाडे उत्पन्न',
      incomeDesc: 'ऑपरेटिंग कॅश फ्लोमधून मासिक वितरण, ऑन-चेन सेटलमेंट.',
      liquidityTitle: 'नियोजित तरलता',
      liquidityDesc: 'SanovaAMM ट्रेजरी किंवा दुय्यम बाजारातून बाहेर पडणे.',
      complianceTitle: 'अनुपालन प्रथम',
      complianceDesc: 'KYC, कर प्रकटीकरण आणि ऑडिट करण्यायोग्य ऑन-चेन नोंदी.'
    },
    cta: {
      title: 'तुमचे वास्तविक-मालमत्ता पोर्टफोलिओ सुरू करा',
      subtitle: 'संस्थात्मक दर्जाच्या टोकनाइज्ड रिअल इस्टेटमध्ये प्रवेश.',
      button: 'मार्केटप्लेस उघडा'
    },
    footer: {
      tagline: 'RWA · टोकनाइज्ड रिअल इस्टेट',
      disclaimer:
        'ही साइट केवळ माहितीसाठी आहे आणि विक्री किंवा खरेदीची ऑफर नाही. मागील कामगिरी भविष्याची हमी देत नाही.',
      rights: '© 2019–2026 Sanova Global. सर्व हक्क राखीव.',
      privacy: 'गोपनीयता',
      terms: 'अटी'
    }
  },
  access: {
    title: 'प्लॅटफॉर्म प्रवेश',
    subtitle: 'खाते असल्यास साइन इन करा, नवीन असल्यास नोंदणी आणि KYC पूर्ण करा.',
    loginTitle: 'साइन इन',
    loginDesc: 'सत्यापित खाते आणि वॉलेटसह मार्केटप्लेस आणि पोर्टफोलिओ.',
    loginButton: 'मार्केटप्लेसवर जा',
    registerTitle: 'खाते तयार करा',
    registerDesc: 'नवीन गुंतवणूकदार म्हणून नोंदणी. पहिल्या खरेदीपूर्वी KYC आवश्यक.',
    registerButton: 'नोंदणी आणि KYC सुरू',
    kycTitle: 'ओळख पडताळणी (KYC)',
    kycDesc: 'नियामक अनुपालनासाठी ओळख पडताळणी आवश्यक.',
    kycButton: 'KYC पुढे चालू ठेवा',
    backHome: 'मुख्यपृष्ठावर परत'
  }
});
