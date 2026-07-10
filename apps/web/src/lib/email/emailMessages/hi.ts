import type { EmailMessagesPatch } from './types';

export const hi: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Sanova Global टीम'
  },
  activation: {
    subject: 'अपना खाता सक्रिय करें — Sanova Global',
    intro: 'Sanova Global में रजिस्टर करने के लिए धन्यवाद।',
    cta: 'अपना खाता सक्रिय करें',
    expiry: 'यह लिंक 24 घंटे में समाप्त हो जाएगा। यदि आपने यह खाता नहीं बनाया है, तो इस संदेश को नज़रअंदाज़ करें।'
  },
  verificationCode: {
    subject: 'आपका Sanova Global सत्यापन कोड',
    label: 'आपका Sanova सत्यापन कोड है:',
    expiry: 'यह कोड 10 मिनट में समाप्त हो जाएगा।',
    ignore: 'अगर आपने यह एक्सेस नहीं मांगा है, तो आप इस संदेश को नज़रअंदाज़ कर सकते हैं।'
  },
  passwordReset: {
    subject: 'अपना पासवर्ड रीसेट करें — Sanova Global',
    intro: 'हमें आपके Sanova खाते का पासवर्ड रीसेट करने का अनुरोध मिला है।',
    cta: 'पासवर्ड रीसेट करें',
    expiry: 'यह लिंक 1 घंटे में समाप्त हो जाएगा। अगर आपने यह बदलाव नहीं मांगा है, तो इसे नज़रअंदाज़ करें।'
  },
  accountApproved: {
    subject: 'आपका Sanova Capital खाता स्वीकृत हो गया है!',
    greeting: 'नमस्ते {name},',
    approvedLine: 'आपकी पहचान सत्यापन (KYC) सफलतापूर्वक स्वीकृत हो गई है और आपका खाता तैयार है।',
    accessLine: 'अब आप प्लेटफ़ॉर्म पर जा सकते हैं और Sanova Capital मार्केटप्लेस में निवेश शुरू कर सकते हैं।',
    cta: 'प्लेटफ़ॉर्म पर जाएं',
    closing: 'शुभकामनाएं,'
  },
  purchaseConfirmation: {
    subject: 'निवेश पुष्टि: {project}',
    greeting: 'नमस्ते {name},',
    receivedLine: 'हमें प्रोजेक्ट "{project}" में आपका USD {amount} का निवेश मिल गया है।',
    confirmedLine: 'हमने प्लेटफ़ॉर्म पर आपके निवेश की पुष्टि कर दी है।',
    projectLabel: 'प्रोजेक्ट:',
    amountLabel: 'निवेश की गई राशि:',
    trackingLine: 'आप अपने खाता डैशबोर्ड से अपनी संपत्ति और रिटर्न को ट्रैक कर सकते हैं।',
    thanks: 'Sanova Capital पर भरोसा करने के लिए धन्यवाद।'
  },
  advisorClientApproved: {
    subject: 'क्लाइंट KYC स्वीकृत: {clientName}',
    body: 'आपके क्लाइंट {clientName} ({clientEmail}) ने KYC पूरा कर लिया है और स्वीकृत हो गया है। अब वे मार्केटप्लेस में काम कर सकते हैं।'
  },
  advisorClientPurchase: {
    subject: 'आपके क्लाइंट की खरीद: {clientName}',
    body: '{clientName} ({clientEmail}) ने "{project}" में USD {amount} के टोकन खरीदे। कमीशन वर्तमान नीति के अनुसार जमा होंगे।'
  },
  invite: {
    investorSubject: 'Sanova Global आमंत्रण — निवेशक',
    teamSubject: 'Sanova Global आमंत्रण — {roleLabel}',
    greeting: 'नमस्ते{name},',
    investorBody: 'आपको Sanova Global के टोकनयुक्त संपत्तियों में निवेश करने के लिए आमंत्रित किया गया है। आमंत्रण स्वीकार करने और अपना KYC सत्यापन शुरू करने के लिए यह लिंक खोलें:',
    teamBody: 'आपको {roleLabel} के रूप में Sanova Global में शामिल होने के लिए आमंत्रित किया गया है। आमंत्रण स्वीकार करने और KYC सत्यापन जारी रखने के लिए यह लिंक खोलें:',
    reminderPrefix: 'अनुस्मारक: ',
    cta: 'आमंत्रण स्वीकार करें',
    expiry: 'यह लिंक 7 दिनों में समाप्त हो जाएगा।',
    ignore: 'यदि आपने इस ईमेल की अपेक्षा नहीं की थी, तो आप इसे नज़रअंदाज़ कर सकते हैं।',
    roleAdvisor: 'सलाहकार',
    roleAdvisorManager: 'प्रबंधक'
  }
};
