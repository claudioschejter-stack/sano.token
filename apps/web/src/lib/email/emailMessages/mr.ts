import type { EmailMessagesPatch } from './types';

export const mr: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Sanova Global टीम'
  },
  activation: {
    subject: 'तुमचे खाते सक्रिय करा — Sanova Global',
    intro: 'Sanova Global मध्ये नोंदणी केल्याबद्दल धन्यवाद.',
    cta: 'खाते सक्रिय करा',
    expiry: 'ही लिंक २४ तासांत कालबाह्य होईल. तुम्ही हे खाते तयार केले नसेल, तर हा संदेश दुर्लक्षित करा.'
  },
  verificationCode: {
    subject: 'तुमचा Sanova Global पडताळणी कोड',
    label: 'तुमचा Sanova पडताळणी कोड आहे:',
    expiry: 'हा कोड १० मिनिटांत कालबाह्य होईल.',
    ignore: 'तुम्ही ही विनंती केली नसेल, तर हा संदेश सुरक्षितपणे दुर्लक्षित करू शकता.'
  },
  passwordReset: {
    subject: 'तुमचा पासवर्ड रीसेट करा — Sanova Global',
    intro: 'तुमच्या Sanova खात्याचा पासवर्ड रीसेट करण्याची विनंती आम्हाला मिळाली आहे.',
    cta: 'पासवर्ड रीसेट करा',
    expiry: 'ही लिंक १ तासात कालबाह्य होईल. तुम्ही हा बदल विनंती केला नसेल, तर हा संदेश दुर्लक्षित करा.'
  },
  accountApproved: {
    subject: 'तुमचे Sanova Capital खाते मंजूर झाले आहे!',
    greeting: 'नमस्कार {name},',
    approvedLine: 'तुमची ओळख पडताळणी (KYC) यशस्वीरित्या मंजूर झाली आहे आणि तुमचे खाते तयार आहे.',
    accessLine: 'आता तुम्ही प्लॅटफॉर्मवर प्रवेश करू शकता आणि Sanova Capital मार्केटप्लेसमध्ये गुंतवणूक सुरू करू शकता.',
    cta: 'प्लॅटफॉर्मवर जा',
    closing: 'शुभेच्छा,'
  },
  purchaseConfirmation: {
    subject: 'गुंतवणूक पुष्टीकरण: {project}',
    greeting: 'नमस्कार {name},',
    receivedLine: 'आम्हाला "{project}" प्रोजेक्टमध्ये तुमची USD {amount} गुंतवणूक मिळाली आहे.',
    confirmedLine: 'आम्ही प्लॅटफॉर्मवर तुमची गुंतवणूक पुष्टी केली आहे.',
    projectLabel: 'प्रोजेक्ट:',
    amountLabel: 'गुंतवलेली रक्कम:',
    trackingLine: 'तुम्ही तुमच्या खाते डॅशबोर्डवरून तुमच्या मालमत्ता आणि परताव्याचा मागोवा घेऊ शकता.',
    thanks: 'Sanova Capital वर विश्वास ठेवल्याबद्दल धन्यवाद.'
  },
  advisorClientApproved: {
    subject: 'क्लायंट KYC मंजूर: {clientName}',
    body: 'तुमच्या क्लायंट {clientName} ({clientEmail}) यांनी KYC पूर्ण केले आहे आणि मंजूर झाले आहे. आता ते मार्केटप्लेसमध्ये व्यवहार करू शकतात.'
  },
  advisorClientPurchase: {
    subject: 'तुमच्या क्लायंटची खरेदी: {clientName}',
    body: '{clientName} ({clientEmail}) यांनी "{project}" मध्ये USD {amount} किंमतीचे टोकन खरेदी केले. सध्याच्या धोरणानुसार कमिशन जमा होईल.'
  },
  invite: {
    investorSubject: 'Sanova Global आमंत्रण — गुंतवणूकदार',
    teamSubject: 'Sanova Global आमंत्रण — {roleLabel}',
    greeting: 'नमस्कार{name},',
    investorBody: 'तुम्हाला Sanova Global च्या टोकनयुक्त मालमत्तांमध्ये गुंतवणूक करण्यासाठी आमंत्रित केले आहे. आमंत्रण स्वीकारण्यासाठी आणि तुमची KYC पडताळणी सुरू करण्यासाठी ही लिंक उघडा:',
    teamBody: 'तुम्हाला {roleLabel} म्हणून Sanova Global मध्ये सामील होण्यासाठी आमंत्रित केले आहे. आमंत्रण स्वीकारण्यासाठी आणि KYC पडताळणी सुरू ठेवण्यासाठी ही लिंक उघडा:',
    reminderPrefix: 'स्मरणपत्र: ',
    cta: 'आमंत्रण स्वीकारा',
    expiry: 'ही लिंक ७ दिवसांत कालबाह्य होईल.',
    ignore: 'तुम्हाला हा ईमेल अपेक्षित नसेल, तर तुम्ही तो दुर्लक्षित करू शकता.',
    roleAdvisor: 'सल्लागार',
    roleAdvisorManager: 'व्यवस्थापक'
  }
};
