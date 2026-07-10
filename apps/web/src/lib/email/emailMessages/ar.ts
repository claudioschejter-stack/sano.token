import type { EmailMessagesPatch } from './types';

export const ar: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'فريق Sanova Global'
  },
  activation: {
    subject: 'فعّل حسابك — Sanova Global',
    intro: 'شكرًا لتسجيلك في Sanova Global.',
    cta: 'فعّل حسابك',
    expiry: 'تنتهي صلاحية هذا الرابط في 24 ساعة. إذا لم تُنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة.'
  },
  verificationCode: {
    subject: 'رمز التحقق الخاص بك من Sanova Global',
    label: 'رمز التحقق الخاص بك في Sanova هو:',
    expiry: 'تنتهي صلاحية هذا الرمز في 10 دقائق.',
    ignore: 'إذا لم تطلب هذا الوصول، يمكنك تجاهل هذه الرسالة بأمان.'
  },
  passwordReset: {
    subject: 'إعادة تعيين كلمة المرور — Sanova Global',
    intro: 'تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك في Sanova.',
    cta: 'إعادة تعيين كلمة المرور',
    expiry: 'تنتهي صلاحية هذا الرابط في ساعة واحدة. إذا لم تطلب هذا التغيير، يمكنك تجاهل هذه الرسالة.'
  },
  accountApproved: {
    subject: 'تمت الموافقة على حسابك في Sanova Capital!',
    greeting: 'مرحبًا {name}،',
    approvedLine: 'تمت الموافقة على عملية التحقق من هويتك (KYC) بنجاح وحسابك جاهز الآن.',
    accessLine: 'يمكنك الآن الوصول إلى المنصة والبدء في الاستثمار في سوق Sanova Capital.',
    cta: 'الانتقال إلى المنصة',
    closing: 'مع أطيب التحيات،'
  },
  purchaseConfirmation: {
    subject: 'تأكيد الاستثمار: {project}',
    greeting: 'مرحبًا {name}،',
    receivedLine: 'استلمنا استثمارك بقيمة {amount} دولار أمريكي في مشروع "{project}".',
    confirmedLine: 'لقد أكّدنا استثمارك على المنصة.',
    projectLabel: 'المشروع:',
    amountLabel: 'المبلغ المستثمر:',
    trackingLine: 'يمكنك تتبّع أصولك وعوائدك من لوحة تحكم حسابك.',
    thanks: 'شكرًا لثقتك في Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'تمت الموافقة على KYC العميل: {clientName}',
    body: 'أكمل عميلك {clientName} ({clientEmail}) عملية KYC وتمت الموافقة عليه. يمكنه الآن التداول في السوق.'
  },
  advisorClientPurchase: {
    subject: 'عملية شراء من عميلك: {clientName}',
    body: 'قام {clientName} ({clientEmail}) بشراء رموز في "{project}" بقيمة {amount} دولار أمريكي. تُحتسب العمولات وفقًا للسياسة المعمول بها.'
  },
  invite: {
    investorSubject: 'دعوة Sanova Global — مستثمر',
    teamSubject: 'دعوة Sanova Global — {roleLabel}',
    greeting: 'مرحبًا{name}،',
    investorBody:
      'تمت دعوتك للاستثمار في الأصول المُرمّزة الخاصة بـ Sanova Global. لقبول الدعوة وبدء التحقق من KYC، افتح هذا الرابط:',
    teamBody: 'تمت دعوتك للانضمام إلى Sanova Global بصفة {roleLabel}. لقبول الدعوة والمتابعة مع التحقق من KYC، افتح هذا الرابط:',
    reminderPrefix: 'تذكير: ',
    cta: 'قبول الدعوة',
    expiry: 'تنتهي صلاحية هذا الرابط في 7 أيام.',
    ignore: 'إذا لم تكن تتوقع هذا البريد الإلكتروني، يمكنك تجاهله.',
    roleAdvisor: 'مستشار',
    roleAdvisorManager: 'مدير'
  }
};
