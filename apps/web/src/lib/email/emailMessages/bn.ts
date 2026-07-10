import type { EmailMessagesPatch } from './types';

export const bn: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Sanova Global টিম'
  },
  activation: {
    subject: 'আপনার অ্যাকাউন্ট সক্রিয় করুন — Sanova Global',
    intro: 'Sanova Global-এ নিবন্ধনের জন্য ধন্যবাদ।',
    cta: 'অ্যাকাউন্ট সক্রিয় করুন',
    expiry: 'এই লিংকটি ২৪ ঘণ্টায় মেয়াদ শেষ হয়ে যাবে। আপনি এই অ্যাকাউন্ট তৈরি না করলে, এই বার্তাটি উপেক্ষা করতে পারেন।'
  },
  verificationCode: {
    subject: 'আপনার Sanova Global যাচাইকরণ কোড',
    label: 'আপনার Sanova যাচাইকরণ কোড হলো:',
    expiry: 'এই কোডটি ১০ মিনিটে মেয়াদ শেষ হয়ে যাবে।',
    ignore: 'আপনি এই অ্যাক্সেস অনুরোধ না করলে, এই বার্তাটি নিরাপদে উপেক্ষা করতে পারেন।'
  },
  passwordReset: {
    subject: 'আপনার পাসওয়ার্ড রিসেট করুন — Sanova Global',
    intro: 'আমরা আপনার Sanova অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার একটি অনুরোধ পেয়েছি।',
    cta: 'পাসওয়ার্ড রিসেট করুন',
    expiry: 'এই লিংকটি ১ ঘণ্টায় মেয়াদ শেষ হয়ে যাবে। আপনি এই পরিবর্তন অনুরোধ না করলে, এই বার্তাটি উপেক্ষা করতে পারেন।'
  },
  accountApproved: {
    subject: 'আপনার Sanova Capital অ্যাকাউন্ট অনুমোদিত হয়েছে!',
    greeting: 'হ্যালো {name},',
    approvedLine: 'আপনার পরিচয় যাচাই (KYC) সফলভাবে অনুমোদিত হয়েছে এবং আপনার অ্যাকাউন্ট প্রস্তুত।',
    accessLine: 'আপনি এখন প্ল্যাটফর্মে প্রবেশ করতে পারেন এবং Sanova Capital মার্কেটপ্লেসে বিনিয়োগ শুরু করতে পারেন।',
    cta: 'প্ল্যাটফর্মে যান',
    closing: 'শুভেচ্ছা সহ,'
  },
  purchaseConfirmation: {
    subject: 'বিনিয়োগ নিশ্চিতকরণ: {project}',
    greeting: 'হ্যালো {name},',
    receivedLine: 'আমরা "{project}" প্রজেক্টে আপনার USD {amount} বিনিয়োগ পেয়েছি।',
    confirmedLine: 'আমরা প্ল্যাটফর্মে আপনার বিনিয়োগ নিশ্চিত করেছি।',
    projectLabel: 'প্রজেক্ট:',
    amountLabel: 'বিনিয়োগকৃত পরিমাণ:',
    trackingLine: 'আপনি আপনার অ্যাকাউন্ট ড্যাশবোর্ড থেকে আপনার সম্পদ এবং রিটার্ন ট্র্যাক করতে পারেন।',
    thanks: 'Sanova Capital-এ আস্থা রাখার জন্য ধন্যবাদ।'
  },
  advisorClientApproved: {
    subject: 'ক্লায়েন্ট KYC অনুমোদিত: {clientName}',
    body: 'আপনার ক্লায়েন্ট {clientName} ({clientEmail}) KYC সম্পন্ন করেছেন এবং অনুমোদিত হয়েছেন। তিনি এখন মার্কেটপ্লেসে কাজ করতে পারেন।'
  },
  advisorClientPurchase: {
    subject: 'আপনার ক্লায়েন্টের ক্রয়: {clientName}',
    body: '{clientName} ({clientEmail}) "{project}"-এ USD {amount} মূল্যের টোকেন ক্রয় করেছেন। কমিশন বিদ্যমান নীতি অনুযায়ী সংগৃহীত হবে।'
  },
  invite: {
    investorSubject: 'Sanova Global আমন্ত্রণ — বিনিয়োগকারী',
    teamSubject: 'Sanova Global আমন্ত্রণ — {roleLabel}',
    greeting: 'হ্যালো{name},',
    investorBody: 'আপনাকে Sanova Global-এর টোকেনাইজড সম্পদে বিনিয়োগ করতে আমন্ত্রণ জানানো হয়েছে। আমন্ত্রণ গ্রহণ করতে এবং আপনার KYC যাচাইকরণ শুরু করতে এই লিংকটি খুলুন:',
    teamBody: 'আপনাকে {roleLabel} হিসেবে Sanova Global-এ যোগদানের জন্য আমন্ত্রণ জানানো হয়েছে। আমন্ত্রণ গ্রহণ করতে এবং KYC যাচাইকরণ চালিয়ে যেতে এই লিংকটি খুলুন:',
    reminderPrefix: 'অনুস্মারক: ',
    cta: 'আমন্ত্রণ গ্রহণ করুন',
    expiry: 'এই লিংকটি ৭ দিনে মেয়াদ শেষ হয়ে যাবে।',
    ignore: 'আপনি এই ইমেইলটি প্রত্যাশা না করলে, আপনি এটি উপেক্ষা করতে পারেন।',
    roleAdvisor: 'উপদেষ্টা',
    roleAdvisorManager: 'ম্যানেজার'
  }
};
