import type { EmailMessagesPatch } from './types';

export const sw: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Timu ya Sanova Global'
  },
  activation: {
    subject: 'Amilisha akaunti yako — Sanova Global',
    intro: 'Asante kwa kujiandikisha na Sanova Global.',
    cta: 'Amilisha akaunti yako',
    expiry: 'Kiungo hiki kitaisha muda wake baada ya masaa 24. Ikiwa hukuunda akaunti hii, unaweza kupuuza ujumbe huu.'
  },
  verificationCode: {
    subject: 'Msimbo wako wa uthibitishaji wa Sanova Global',
    label: 'Msimbo wako wa uthibitishaji wa Sanova ni:',
    expiry: 'Msimbo huu utaisha muda wake baada ya dakika 10.',
    ignore: 'Ikiwa hukuomba ufikiaji huu, unaweza kupuuza ujumbe huu kwa usalama.'
  },
  passwordReset: {
    subject: 'Weka upya nenosiri lako — Sanova Global',
    intro: 'Tumepokea ombi la kuweka upya nenosiri la akaunti yako ya Sanova.',
    cta: 'Weka upya nenosiri',
    expiry: 'Kiungo hiki kitaisha muda wake baada ya saa 1. Ikiwa hukuomba mabadiliko haya, unaweza kupuuza ujumbe huu.'
  },
  accountApproved: {
    subject: 'Akaunti yako ya Sanova Capital imekubaliwa!',
    greeting: 'Habari {name},',
    approvedLine: 'Uthibitisho wako wa utambulisho (KYC) umekubaliwa kwa mafanikio na akaunti yako iko tayari.',
    accessLine: 'Sasa unaweza kufikia jukwaa na kuanza kuwekeza kwenye soko la Sanova Capital.',
    cta: 'Fungua jukwaa',
    closing: 'Kwa heshima,'
  },
  purchaseConfirmation: {
    subject: 'Uthibitisho wa uwekezaji: {project}',
    greeting: 'Habari {name},',
    receivedLine: 'Tumepokea uwekezaji wako wa USD {amount} katika mradi "{project}".',
    confirmedLine: 'Tumethibitisha uwekezaji wako kwenye jukwaa.',
    projectLabel: 'Mradi:',
    amountLabel: 'Kiasi kilichowekezwa:',
    trackingLine: 'Unaweza kufuatilia mali na mapato yako kutoka kwa dashibodi ya akaunti yako.',
    thanks: 'Asante kwa kumwamini Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'KYC ya mteja imekubaliwa: {clientName}',
    body: 'Mteja wako {clientName} ({clientEmail}) amekamilisha KYC na amekubaliwa. Sasa anaweza kufanya biashara kwenye soko.'
  },
  advisorClientPurchase: {
    subject: 'Ununuzi wa mteja wako: {clientName}',
    body: '{clientName} ({clientEmail}) alinunua tokeni katika "{project}" kwa USD {amount}. Kamisheni zitalimbikizwa kulingana na sera iliyopo.'
  },
  invite: {
    investorSubject: 'Mwaliko wa Sanova Global — Mwekezaji',
    teamSubject: 'Mwaliko wa Sanova Global — {roleLabel}',
    greeting: 'Habari{name},',
    investorBody: 'Umealikwa kuwekeza katika mali za tokeni za Sanova Global. Ili kukubali mwaliko na kuanza uthibitisho wako wa KYC, fungua kiungo hiki:',
    teamBody: 'Umealikwa kujiunga na Sanova Global kama {roleLabel}. Ili kukubali mwaliko na kuendelea na uthibitisho wa KYC, fungua kiungo hiki:',
    reminderPrefix: 'Ukumbusho: ',
    cta: 'Kubali mwaliko',
    expiry: 'Kiungo hiki kitaisha muda wake baada ya siku 7.',
    ignore: 'Ikiwa hukutarajia barua pepe hii, unaweza kuipuuza.',
    roleAdvisor: 'Mshauri',
    roleAdvisorManager: 'Meneja'
  }
};
