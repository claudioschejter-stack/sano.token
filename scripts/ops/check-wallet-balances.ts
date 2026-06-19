import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

const LEGACY = '0x7AC277Cd631E4D91149Ef3E719d96e505f3DAb1B';
const MORPHO = '0xa27450116E04eb845d741767d9e798Ccf828fDC1';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function main() {
  const provider = new JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const usdc = new Contract(USDC, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], provider);
  const dec = await usdc.decimals();

  for (const label of ['legacy', 'morpho'] as const) {
    const addr = label === 'legacy' ? LEGACY : MORPHO;
    const eth = await provider.getBalance(addr);
    const usdcBal = await usdc.balanceOf(addr);
    console.log(label, addr, 'ETH', formatUnits(eth, 18), 'USDC', formatUnits(usdcBal, dec));
  }
  provider.destroy();
}

main().catch(console.error);
