import type { EmailMessagesPatch } from './types';

export const ru: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Команда Sanova Global'
  },
  activation: {
    subject: 'Активируйте свой аккаунт — Sanova Global',
    intro: 'Спасибо за регистрацию в Sanova Global.',
    cta: 'Активировать аккаунт',
    expiry: 'Ссылка действительна 24 часа. Если вы не создавали этот аккаунт, просто игнорируйте это письмо.'
  },
  verificationCode: {
    subject: 'Ваш код подтверждения Sanova Global',
    label: 'Ваш код подтверждения Sanova:',
    expiry: 'Код действителен 10 минут.',
    ignore: 'Если вы не запрашивали доступ, просто игнорируйте это письмо.'
  },
  passwordReset: {
    subject: 'Сброс пароля — Sanova Global',
    intro: 'Мы получили запрос на сброс пароля вашего аккаунта Sanova.',
    cta: 'Сбросить пароль',
    expiry: 'Ссылка действительна 1 час. Если вы не запрашивали это изменение, просто игнорируйте это письмо.'
  },
  accountApproved: {
    subject: 'Ваш аккаунт Sanova Capital одобрен!',
    greeting: 'Здравствуйте, {name},',
    approvedLine: 'Ваша проверка личности (KYC) успешно одобрена, и ваш аккаунт готов.',
    accessLine: 'Теперь вы можете зайти на платформу и начать инвестировать на маркетплейсе Sanova Capital.',
    cta: 'Перейти на платформу',
    closing: 'С уважением,'
  },
  purchaseConfirmation: {
    subject: 'Подтверждение инвестиции: {project}',
    greeting: 'Здравствуйте, {name},',
    receivedLine: 'Мы получили вашу инвестицию на сумму {amount} USD в проект «{project}».',
    confirmedLine: 'Мы подтвердили вашу инвестицию на платформе.',
    projectLabel: 'Проект:',
    amountLabel: 'Инвестированная сумма:',
    trackingLine: 'Вы можете отслеживать свои активы и доходность на панели управления аккаунтом.',
    thanks: 'Благодарим за доверие к Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'KYC клиента одобрен: {clientName}',
    body: 'Ваш клиент {clientName} ({clientEmail}) прошёл проверку KYC и был одобрен. Теперь он(а) может работать на маркетплейсе.'
  },
  advisorClientPurchase: {
    subject: 'Покупка вашего клиента: {clientName}',
    body: '{clientName} ({clientEmail}) приобрёл токены в проекте «{project}» на сумму {amount} USD. Комиссии начисляются согласно действующей политике.'
  },
  invite: {
    investorSubject: 'Приглашение Sanova Global — Инвестор',
    teamSubject: 'Приглашение Sanova Global — {roleLabel}',
    greeting: 'Здравствуйте{name},',
    investorBody:
      'Вас пригласили инвестировать в токенизированные активы Sanova Global. Чтобы принять приглашение и начать проверку KYC, откройте эту ссылку:',
    teamBody:
      'Вас пригласили присоединиться к Sanova Global в роли «{roleLabel}». Чтобы принять приглашение и продолжить проверку KYC, откройте эту ссылку:',
    reminderPrefix: 'Напоминание: ',
    cta: 'Принять приглашение',
    expiry: 'Ссылка действительна 7 дней.',
    ignore: 'Если вы не ожидали это письмо, можете его игнорировать.',
    roleAdvisor: 'Консультант',
    roleAdvisorManager: 'Менеджер'
  }
};
