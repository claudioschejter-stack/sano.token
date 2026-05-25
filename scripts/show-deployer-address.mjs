import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readKeyFromFile(path) {
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim();
    let val = rest.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'TOKEN_DEPLOY_PRIVATE_KEY' || key === 'PRIVATE_KEY') {
      return val || null;
    }
  }
  return null;
}

const privateKey =
  readKeyFromFile(join(root, '.env')) ??
  readKeyFromFile(join(root, 'apps/web/.env.local'));

if (!privateKey) {
  console.error('No se encontró TOKEN_DEPLOY_PRIVATE_KEY en .env ni apps/web/.env.local');
  process.exit(1);
}

const wallet = new Wallet(privateKey);

console.log('');
console.log('=== Wallet deployer (Sanova) ===');
console.log('Dirección pública:', wallet.address);
console.log('Base Sepolia:     ', `https://sepolia.basescan.org/address/${wallet.address}`);
console.log('');
console.log('Esta es la wallet que necesita ETH de testnet para emitir tokens.');
console.log('');
