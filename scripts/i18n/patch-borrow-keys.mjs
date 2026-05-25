import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../../apps/web/src/i18n/locales');

const borrowBlock = `    lendingRatesLiveFootnote: "Live rates aggregated from DefiLlama and on-chain reads ({count} lenders with market data).",
    lendingRatesUpdated: "Updated",
    borrow: {
      title: "Borrow on DeFi",
      subtitle: "Connect your wallet and execute a loan on the best available protocol (Aave v3 or Morpho on Base).",
      bestRateHint: "Best rate detected",
      amountLabel: "Amount to borrow (USDC)",
      collateralLabel: "WETH collateral to supply on Aave (optional)",
      connectWallet: "Connect wallet",
      walletConnected: "Wallet connected.",
      connectFirst: "Connect your wallet first.",
      borrowButton: "Execute loan",
      preparing: "Preparing transactions…",
      signingStep: "Sign transaction {step} in your wallet…",
      success: "Loan submitted on-chain. Check your wallet.",
      prepareFailed: "Could not prepare the loan.",
      noWallet: "Install MetaMask or another EIP-1193 compatible wallet.",
      disclaimer: "On-chain operation with market risk. For ERC-4626 collateral (RWA tokens), the Morpho market is created when the vault is issued (Phase C)."
    },`;

const skip = new Set(['en.ts', 'es.ts', 'mergeLocale.ts']);

for (const file of fs.readdirSync(localesDir)) {
  if (!file.endsWith('.ts') || skip.has(file)) continue;

  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('lendingRatesLiveFootnote')) {
    console.log(`skip ${file} (already patched)`);
    continue;
  }

  const match = content.match(/(\s+lendingRatesFootnote:[^\n]+\n)(\s+lenderRegions:\s*\{)/);
  if (!match) {
    console.error(`no match in ${file}`);
    process.exitCode = 1;
    continue;
  }

  content = content.replace(match[0], `${match[1]}${borrowBlock}\n${match[2]}`);
  fs.writeFileSync(filePath, content);
  console.log(`patched ${file}`);
}
