const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src/i18n/locales');
const skip = new Set(['en.ts', 'es.ts', 'mergeLocale.ts']);

const projectYieldBlock = `  projectYield: {
    title: "Yield and dividends by project",
    subtitle: "Target return, liquidated cash flows and latest payments per RWA asset.",
    empty: "Invest in at least one project to see yield and dividends by asset.",
    totalReceived: "Total received",
    weightedTarget: "Weighted target yield",
    realizedYield: "Realized yield",
    targetApy: "Target APY",
    invested: "Invested",
    received: "Received",
    lastPayment: "Last payment",
    recentPayments: "Recent payments",
    viewTx: "View transaction"
  },
`;

const dashboardKeys = `    kpiPortfolioYield: "Portfolio target yield",
    kpiPortfolioYieldHint: "Weighted APY across your invested projects",`;

const portfolioBlock = `    kpiCapital: "Capital",
    kpiMarginDebt: "Margin debt",
    kpiMarginDebtHint: "Outstanding liability",
    kpiLtv: "LTV",
    kpiLtvHint: "Loan-to-value",
    colAsset: "Asset",
    colTokens: "Tokens",
    colInvested: "Invested",
    colDate: "Date",
    colCurrentValue: "Current value",
    colVaultShares: "Vault shares",
    onChainVerified: "On-chain verified (ERC-4626)",
    onChainPending: "Pending on-chain sync",
    viewVault: "View vault",
    viewPurchaseTx: "View purchase"`;

const checkoutKeys = `    purchaseComplete: "Purchase confirmed. Your ERC-4626 vault shares are in your wallet.",
    viewPortfolio: "View my portfolio",`;

const platformWalletBlock = `  platformWallet: {
    eyebrow: "Sanova Wallet",
    title: "My wallet",
    subtitle: "Deposit USDC or fiat, withdraw to your wallet, and use balance to buy RWA tokens.",
    buyTokens: "Buy tokens",
    kpiAvailable: "Available balance",
    kpiAvailableHint: "Ready to invest or withdraw",
    kpiTotal: "Total balance",
    kpiReserved: "Reserved",
    kpiStatus: "Account status",
    kycHint: "Approved KYC required to deposit, withdraw and trade.",
    tabDeposit: "Deposit",
    tabWithdraw: "Withdraw",
    tabHistory: "History",
    depositTitle: "Deposit funds",
    depositSubtitle: "The system picks the cheapest route (USDC on-chain on Base recommended).",
    withdrawTitle: "Withdraw funds",
    withdrawSubtitle: "USDC to your connected wallet or fiat withdrawal with treasury review.",
    amountPlaceholder: "Amount USD",
    methodAuto: "Auto: cheapest option",
    methodUsdc: "USDC on-chain",
    methodTransak: "Transak (fiat → crypto)",
    methodBridge: "Bridge",
    methodStripe: "Stripe",
    methodMercadoPago: "Mercado Pago",
    methodCoinbase: "Coinbase",
    hasStablecoin: "I already have stablecoins",
    createDeposit: "Create deposit",
    routeSelected: "Route: {label} · fee ~USD {fee}",
    verifyTitle: "Verify USDC deposit",
    verifySubtitle: "Send USDC to treasury and paste the tx hash to credit your balance.",
    sendToTreasury: "Send to treasury",
    txHashPlaceholder: "Tx hash",
    verifyButton: "Verify and credit",
    noDepositYet: "Create an on-chain USDC deposit to see instructions.",
    withdrawStablecoin: "USDC to my wallet",
    withdrawFiat: "Fiat (manual review)",
    fiatHint: "Treasury will process your bank withdrawal in 1–3 business days.",
    destinationPlaceholder: "Destination address",
    requestWithdrawal: "Request withdrawal",
    withdrawalCreated: "Withdrawal {id} · {status}",
    historyTitle: "Activity history",
    historySubtitle: "Deposits, withdrawals and internal account operations.",
    historyEmpty: "No activity yet.",
    colType: "Type",
    colDate: "Date",
    colAmount: "Amount",
    colStatus: "Status",
    ledgerDeposit: "Deposit credited",
    ledgerPurchase: "Token purchase",
    ledgerWithdrawal: "Withdrawal",
    ledgerRefund: "Refund",
    ledgerAdjustment: "Manual adjustment",
    depositLabel: "Deposit",
    withdrawalLabel: "Withdrawal",
    loading: "Loading wallet…",
    depositConfirmed: "Deposit credited successfully.",
    errorDepositCreate: "Could not create deposit.",
    errorDepositVerify: "Could not verify deposit.",
    errorWithdrawal: "Could not request withdrawal."
  },
`;

const accountStatusBlock = `  accountStatus: {
    operationalTitle: "Account verified and operational",
    pendingTitle: "Your account is not yet operational",
    suspendedTitle: "Account suspended",
    suspendedDesc: "Contact Sanova support to restore your access.",
    stepContact: "Verify your email and register your phone to continue.",
    stepKyc: "Complete identity verification (KYC) to deposit, withdraw and invest.",
    stepKycRejected: "Your KYC was rejected. Review your details and try again.",
    stepReview: "We are reviewing your account. We will notify you when it is ready.",
    continueCta: "Complete verification",
    kycLabels: {
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected"
    },
    accountLabels: {
      OPERATIONAL: "Operational",
      ONBOARDING: "Onboarding",
      SUSPENDED: "Suspended"
    }
  },
`;

const userRoleHeaderKycPrefix = `    kycPrefix: "KYC"`;

const dashboardPortfolioKeys = `    kpiTotalPortfolio: "Total portfolio value",
    kpiTotalPortfolioHint: "RWA tokens + stablecoins + fiat, USD base currency",
    portfolioEvolutionTitle: "Portfolio evolution",
    portfolioEvolutionSubtitle: "Total value in USD base currency",
    compositionTitle: "Allocation",
    breakdownRwa: "RWA tokens",
    breakdownStablecoins: "Stablecoins",
    breakdownFiat: "Fiat / Sanova balance",
    consolidatedPositionsTitle: "Consolidated positions",
    baseUsdBadge: "USD base",`;

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.ts') || skip.has(file)) {
    continue;
  }

  const filePath = path.join(dir, file);
  let source = fs.readFileSync(filePath, 'utf8');

  if (!source.includes('kpiTotalPortfolio:')) {
    source = source.replace(/(\n    liveDividend: [^\n]+)\n(  \},)/, `$1,\n${dashboardPortfolioKeys}\n$2`);
  }

  if (!source.includes('kpiPortfolioYield:')) {
    source = source.replace(/(\n    kpiAneloYieldHint: [^\n]+)\n(    chartTitle:)/, `$1,\n${dashboardKeys}\n$2`);
  }

  if (!/portfolio:[\s\S]*?kpiCapital:/.test(source)) {
    source = source.replace(/(portfolio:\s*\{[\s\S]*?comingSoon: [^\n]+)\n(\s*\},)/, (_, before, close) => {
      const needsComma = !before.trimEnd().endsWith(',');
      return `${before}${needsComma ? ',' : ''}\n${portfolioBlock}\n${close}`;
    });
  }

  if (!/checkout:[\s\S]*?viewPortfolio:/.test(source)) {
    source = source.replace(/(\n    connectToContinue: [^\n]+)\n(\s*\},)/, `$1,\n${checkoutKeys}\n$2`);
  }

  if (!source.includes('projectYield:')) {
    source = source.replace(/\n  status: \{/, `\n${projectYieldBlock}\n  status: {`);
  }

  if (!source.includes('platformWallet:')) {
    source = source.replace(/\n  dashboard: \{/, `\n${platformWalletBlock}\n  dashboard: {`);
  }

  if (!source.includes('accountStatus:')) {
    source = source.replace(/\n  managerPortal: \{/, `\n${accountStatusBlock}\n  managerPortal: {`);
  }

  if (!source.includes('kycPrefix:')) {
    source = source.replace(/(\n    approvedStatus: [^\n]+)\n(  \},)/, `$1,\n${userRoleHeaderKycPrefix}\n$2`);
  }

  fs.writeFileSync(filePath, source);
  console.log(`patched ${file}`);
}
