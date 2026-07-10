import type { EmailMessagesPatch } from './types';

export const ja: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Sanova Global チーム'
  },
  activation: {
    subject: 'アカウントを有効化してください — Sanova Global',
    intro: 'Sanova Global にご登録いただきありがとうございます。',
    cta: 'アカウントを有効化する',
    expiry: 'このリンクは24時間で無効になります。このアカウントを作成していない場合は、このメッセージを無視してください。'
  },
  verificationCode: {
    subject: 'Sanova Global 認証コード',
    label: 'あなたのSanova認証コードは次のとおりです：',
    expiry: 'このコードは10分後に無効になります。',
    ignore: 'このアクセスをリクエストしていない場合は、このメッセージを無視して問題ありません。'
  },
  passwordReset: {
    subject: 'パスワードをリセットする — Sanova Global',
    intro: 'Sanovaアカウントのパスワードリセットのリクエストを受け付けました。',
    cta: 'パスワードをリセット',
    expiry: 'このリンクは1時間で無効になります。この変更をリクエストしていない場合は、このメッセージを無視してください。'
  },
  accountApproved: {
    subject: 'Sanova Capitalのアカウントが承認されました！',
    greeting: '{name} 様、',
    approvedLine: '本人確認（KYC）が正常に承認され、アカウントの準備が完了しました。',
    accessLine: 'プラットフォームにアクセスし、Sanova Capitalマーケットプレイスでの投資を開始できます。',
    cta: 'プラットフォームへ移動',
    closing: '敬具、'
  },
  purchaseConfirmation: {
    subject: '投資確認：{project}',
    greeting: '{name} 様、',
    receivedLine: 'プロジェクト「{project}」への{amount} USDの投資を受け付けました。',
    confirmedLine: 'プラットフォーム上で投資が確認されました。',
    projectLabel: 'プロジェクト：',
    amountLabel: '投資額：',
    trackingLine: 'アカウントダッシュボードから資産と収益を確認できます。',
    thanks: 'Sanova Capitalをご利用いただきありがとうございます。'
  },
  advisorClientApproved: {
    subject: 'クライアントのKYCが承認されました：{clientName}',
    body: 'クライアントの{clientName}様（{clientEmail}）がKYCを完了し、承認されました。マーケットプレイスでの取引が可能になりました。'
  },
  advisorClientPurchase: {
    subject: 'クライアントの購入：{clientName}',
    body: '{clientName}様（{clientEmail}）が「{project}」で{amount} USD分のトークンを購入しました。手数料は現行のポリシーに従って発生します。'
  },
  invite: {
    investorSubject: 'Sanova Globalへのご招待 — 投資家',
    teamSubject: 'Sanova Globalへのご招待 — {roleLabel}',
    greeting: '{name} 様、',
    investorBody: 'Sanova Globalのトークン化資産への投資にご招待いたします。招待を受け入れ、KYC認証を開始するには、こちらのリンクを開いてください：',
    teamBody: '{roleLabel}としてSanova Globalに参加するようご招待いたします。招待を受け入れ、KYC認証を続けるには、こちらのリンクを開いてください：',
    reminderPrefix: 'リマインダー：',
    cta: '招待を受け入れる',
    expiry: 'このリンクは7日後に無効になります。',
    ignore: 'このメールに心当たりがない場合は、無視していただいて構いません。',
    roleAdvisor: 'アドバイザー',
    roleAdvisorManager: 'マネージャー'
  }
};
