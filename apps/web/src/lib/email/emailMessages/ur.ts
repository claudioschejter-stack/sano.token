import type { EmailMessagesPatch } from './types';

export const ur: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Sanova Global ٹیم'
  },
  activation: {
    subject: 'اپنا اکاؤنٹ فعال کریں — Sanova Global',
    intro: 'Sanova Global میں رجسٹر ہونے کا شکریہ۔',
    cta: 'اپنا اکاؤنٹ فعال کریں',
    expiry: 'یہ لنک 24 گھنٹوں میں ختم ہو جائے گا۔ اگر آپ نے یہ اکاؤنٹ نہیں بنایا تو اس پیغام کو نظر انداز کریں۔'
  },
  verificationCode: {
    subject: 'آپ کا Sanova Global تصدیقی کوڈ',
    label: 'آپ کا Sanova تصدیقی کوڈ یہ ہے:',
    expiry: 'یہ کوڈ 10 منٹ میں ختم ہو جائے گا۔',
    ignore: 'اگر آپ نے یہ درخواست نہیں کی تو آپ اس پیغام کو نظر انداز کر سکتے ہیں۔'
  },
  passwordReset: {
    subject: 'اپنا پاس ورڈ دوبارہ ترتیب دیں — Sanova Global',
    intro: 'ہمیں آپ کے Sanova اکاؤنٹ کا پاس ورڈ دوبارہ ترتیب دینے کی درخواست موصول ہوئی ہے۔',
    cta: 'پاس ورڈ دوبارہ ترتیب دیں',
    expiry: 'یہ لنک 1 گھنٹے میں ختم ہو جائے گا۔ اگر آپ نے یہ تبدیلی درخواست نہیں کی تو اسے نظر انداز کریں۔'
  },
  accountApproved: {
    subject: 'آپ کا Sanova Capital اکاؤنٹ منظور ہو گیا ہے!',
    greeting: 'ہیلو {name}،',
    approvedLine: 'آپ کی شناختی تصدیق (KYC) کامیابی سے منظور ہو گئی ہے اور آپ کا اکاؤنٹ تیار ہے۔',
    accessLine: 'اب آپ پلیٹ فارم تک رسائی حاصل کر سکتے ہیں اور Sanova Capital مارکیٹ پلیس میں سرمایہ کاری شروع کر سکتے ہیں۔',
    cta: 'پلیٹ فارم پر جائیں',
    closing: 'نیک خواہشات کے ساتھ،'
  },
  purchaseConfirmation: {
    subject: 'سرمایہ کاری کی تصدیق: {project}',
    greeting: 'ہیلو {name}،',
    receivedLine: 'ہمیں پروجیکٹ "{project}" میں آپ کی USD {amount} کی سرمایہ کاری موصول ہو گئی ہے۔',
    confirmedLine: 'ہم نے پلیٹ فارم پر آپ کی سرمایہ کاری کی تصدیق کر دی ہے۔',
    projectLabel: 'پروجیکٹ:',
    amountLabel: 'سرمایہ کاری کی رقم:',
    trackingLine: 'آپ اپنے اکاؤنٹ ڈیش بورڈ سے اپنے اثاثوں اور منافع کا پتہ لگا سکتے ہیں۔',
    thanks: 'Sanova Capital پر بھروسہ کرنے کا شکریہ۔'
  },
  advisorClientApproved: {
    subject: 'کلائنٹ KYC منظور: {clientName}',
    body: 'آپ کے کلائنٹ {clientName} ({clientEmail}) نے KYC مکمل کر لیا ہے اور منظور ہو گیا ہے۔ وہ اب مارکیٹ پلیس میں کام کر سکتے ہیں۔'
  },
  advisorClientPurchase: {
    subject: 'آپ کے کلائنٹ کی خریداری: {clientName}',
    body: '{clientName} ({clientEmail}) نے "{project}" میں USD {amount} کے ٹوکنز خریدے۔ کمیشن موجودہ پالیسی کے مطابق جمع ہوں گے۔'
  },
  invite: {
    investorSubject: 'Sanova Global دعوت — سرمایہ کار',
    teamSubject: 'Sanova Global دعوت — {roleLabel}',
    greeting: 'ہیلو{name}،',
    investorBody:
      'آپ کو Sanova Global کے ٹوکنائزڈ اثاثوں میں سرمایہ کاری کرنے کی دعوت دی گئی ہے۔ دعوت قبول کرنے اور اپنی KYC تصدیق شروع کرنے کے لیے یہ لنک کھولیں:',
    teamBody: 'آپ کو {roleLabel} کے طور پر Sanova Global میں شامل ہونے کی دعوت دی گئی ہے۔ دعوت قبول کرنے اور KYC تصدیق جاری رکھنے کے لیے یہ لنک کھولیں:',
    reminderPrefix: 'یاد دہانی: ',
    cta: 'دعوت قبول کریں',
    expiry: 'یہ لنک 7 دنوں میں ختم ہو جائے گا۔',
    ignore: 'اگر آپ کو اس ای میل کی توقع نہیں تھی تو آپ اسے نظر انداز کر سکتے ہیں۔',
    roleAdvisor: 'مشیر',
    roleAdvisorManager: 'مینیجر'
  }
};
