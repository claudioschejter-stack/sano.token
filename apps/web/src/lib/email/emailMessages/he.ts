import type { EmailMessagesPatch } from './types';

export const he: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'צוות Sanova Global'
  },
  activation: {
    subject: 'הפעילו את החשבון שלכם — Sanova Global',
    intro: 'תודה שנרשמתם ל-Sanova Global.',
    cta: 'הפעילו את החשבון',
    expiry: 'קישור זה יפוג בעוד 24 שעות. אם לא יצרתם חשבון זה, אפשר להתעלם מההודעה.'
  },
  verificationCode: {
    subject: 'קוד האימות שלכם מ-Sanova Global',
    label: 'קוד האימות שלכם ב-Sanova הוא:',
    expiry: 'קוד זה יפוג בעוד 10 דקות.',
    ignore: 'אם לא ביקשתם גישה זו, אפשר להתעלם מההודעה בבטחה.'
  },
  passwordReset: {
    subject: 'איפוס סיסמה — Sanova Global',
    intro: 'קיבלנו בקשה לאיפוס הסיסמה של חשבון Sanova שלכם.',
    cta: 'איפוס סיסמה',
    expiry: 'קישור זה יפוג בעוד שעה. אם לא ביקשתם שינוי זה, אפשר להתעלם מההודעה.'
  },
  accountApproved: {
    subject: 'החשבון שלכם ב-Sanova Capital אושר!',
    greeting: 'שלום {name},',
    approvedLine: 'אימות הזהות (KYC) שלכם אושר בהצלחה והחשבון מוכן לשימוש.',
    accessLine: 'כעת תוכלו להיכנס לפלטפורמה ולהתחיל להשקיע בשוק Sanova Capital.',
    cta: 'כניסה לפלטפורמה'
  }
};
