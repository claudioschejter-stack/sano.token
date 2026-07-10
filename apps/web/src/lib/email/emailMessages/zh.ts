import type { EmailMessagesPatch } from './types';

export const zh: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Sanova Global 团队'
  },
  activation: {
    subject: '激活您的账户 — Sanova Global',
    intro: '感谢您注册 Sanova Global。',
    cta: '激活账户',
    expiry: '此链接将在 24 小时后失效。如果您没有创建此账户，可以忽略此消息。'
  },
  verificationCode: {
    subject: '您的 Sanova Global 验证码',
    label: '您的 Sanova 验证码是：',
    expiry: '此验证码将在 10 分钟后失效。',
    ignore: '如果您没有请求此操作，可以放心忽略此消息。'
  },
  passwordReset: {
    subject: '重置您的密码 — Sanova Global',
    intro: '我们收到了重置您 Sanova 账户密码的请求。',
    cta: '重置密码',
    expiry: '此链接将在 1 小时后失效。如果您没有请求此更改，可以忽略此消息。'
  },
  accountApproved: {
    subject: '您的 Sanova Capital 账户已获批准！',
    greeting: '您好 {name}，',
    approvedLine: '您的身份验证（KYC）已成功获批，您的账户已准备就绪。',
    accessLine: '现在您可以访问平台，并开始在 Sanova Capital 市场进行投资。',
    cta: '前往平台',
    closing: '祝好，'
  },
  purchaseConfirmation: {
    subject: '投资确认：{project}',
    greeting: '您好 {name}，',
    receivedLine: '我们已收到您在项目"{project}"中投资的 {amount} 美元。',
    confirmedLine: '我们已在平台上确认您的投资。',
    projectLabel: '项目：',
    amountLabel: '投资金额：',
    trackingLine: '您可以在账户控制面板中跟踪您的资产和收益。',
    thanks: '感谢您对 Sanova Capital 的信任。'
  },
  advisorClientApproved: {
    subject: '客户 KYC 已获批准：{clientName}',
    body: '您的客户 {clientName}（{clientEmail}）已完成 KYC 并获得批准，现在可以在市场上进行交易。'
  },
  advisorClientPurchase: {
    subject: '您客户的购买：{clientName}',
    body: '{clientName}（{clientEmail}）在"{project}"中购买了价值 {amount} 美元的代币。佣金将根据当前政策计提。'
  },
  invite: {
    investorSubject: 'Sanova Global 邀请 — 投资者',
    teamSubject: 'Sanova Global 邀请 — {roleLabel}',
    greeting: '您好{name}，',
    investorBody: '您已受邀投资 Sanova Global 的代币化资产。要接受邀请并开始您的 KYC 验证，请打开此链接：',
    teamBody: '您已受邀以{roleLabel}身份加入 Sanova Global。要接受邀请并继续进行 KYC 验证，请打开此链接：',
    reminderPrefix: '提醒：',
    cta: '接受邀请',
    expiry: '此链接将在 7 天后失效。',
    ignore: '如果您并未预期收到此邮件，可以忽略它。',
    roleAdvisor: '顾问',
    roleAdvisorManager: '经理'
  }
};
