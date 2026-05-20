import { mergeLocale } from './mergeLocale';

export const ja = mergeLocale({
  brand: { portalSubtitle: 'RWAポータル' },
  common: {
    investNow: '今すぐ投資',
    backToMarketplace: 'マーケットプレイスに戻る',
    projectedApy: '予想APY'
  },
  nav: {
    home: 'ホーム',
    language: '言語',
    marketplace: 'マーケットプレイス',
    dashboard: 'ダッシュボード'
  },
  landing: {
    languageLabel: '言語',
    nav: {
      howItWorks: '仕組み',
      properties: '物件',
      marketplace: 'マーケットプレイス',
      platformAccess: 'プラットフォームへ'
    },
    hero: {
      eyebrow: 'トークン化不動産',
      title: '分割された実物資産を保有。\nオンチェーンで賃料収入。',
      subtitle:
        'Sanova Globalは認証済み投資家とアルゼンチン・ネウケン州バカ・ムエルタ（Vaca Muerta）の生産性資産をつなぎます — 世界有数の非従来型シェールオイル・ガス拠点、世界第2位のガス埋蔵量、世界クラスのインフラ、競争力のある操業コスト、巨大な石油・ガス生産ポテンシャル — 透明な利回り、KYCコンプライアンス、即時決済も。',
      ctaPrimary: '物件を見る',
      ctaSecondary: '仕組み',
      trustLine: '規制枠組み · KYC/AML · USDCオンチェーン分配'
    },
    stats: {
      properties: '公開案件',
      investors: '認証済み投資家',
      distributed: '分配USDC',
      avgApy: '平均予想APY'
    },
    howItWorks: {
      title: '3ステップで投資',
      subtitle: '発見からオンチェーン所有まで — 個人・機関投資家向け。',
      step1Title: 'KYC完了',
      step1Desc: '一度本人確認。Sanovaは規制対応のオンボーディングパートナーと連携。',
      step2Title: '物件を選択',
      step2Desc: '税制、APY、募集進捗が開示されたトークン化資産を閲覧。',
      step3Title: '分配を受取',
      step3Desc: '賃料収入はUSDCでウォレットへ。投資家ポータルで追跡。'
    },
    featured: {
      title: '注目物件',
      subtitle: '透明なトークン経済の実物資産。',
      viewAll: 'すべての案件',
      soldPercent: '{percent}% 売却',
      apyBadge: '{apy}% APY'
    },
    benefits: {
      title: 'Sanova RWAの理由',
      incomeTitle: '継続的賃料収入',
      incomeDesc: '営業キャッシュフローからの月次分配、オンチェーン決済。',
      liquidityTitle: '計画された流動性',
      liquidityDesc: 'SanovaAMMトレジャリーまたはセカンダリー市場での出口。',
      complianceTitle: 'コンプライアンス優先',
      complianceDesc: 'KYC、税制開示、監査可能なオンチェーン記録。'
    },
    cta: {
      title: '実物資産ポートフォリオを始める',
      subtitle: '機関グレードのトークン化不動産へアクセス。',
      button: 'マーケットプレイスを開く'
    },
    footer: {
      tagline: 'RWA · トークン化不動産',
      disclaimer:
        '本サイトは情報提供のみであり、有価証券の売買の勧誘ではありません。過去の実績は将来を保証しません。',
      rights: '© 2019–2026 Sanova Global. All rights reserved.',
      privacy: 'プライバシー',
      terms: '利用規約'
    }
  },
  access: {
    title: 'プラットフォームアクセス',
    subtitle: 'アカウントをお持ちの方はログイン、新規は登録とKYCを完了してください。',
    loginTitle: 'ログイン',
    loginDesc: '認証済みアカウントとウォレットでマーケットプレイスとポートフォリオへ。',
    loginButton: 'マーケットプレイスへ',
    registerTitle: 'アカウント作成',
    registerDesc: '新規投資家として登録。初回購入前にKYCが必要です。',
    registerButton: '登録してKYC開始',
    kycTitle: '本人確認（KYC）',
    kycDesc: '規制遵守のため本人確認が必要です。',
    kycButton: 'KYCへ進む',
    backHome: 'ホームに戻る'
  }
});
