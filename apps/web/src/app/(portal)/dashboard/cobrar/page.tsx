import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import { getStablecoinNetwork } from '../../../../lib/payments/stablecoinNetworks';
import { isMercadoPagoQrConfigured } from '../../../../lib/payments/mercadoPagoQr/config';
import { PaymentQRView } from '../../../../components/payment/PaymentQRView';

/**
 * "Cobrar" page — shows two universal QR codes for receiving payments:
 *   • Fiat QR  → Transak on-ramp (credit card / bank transfer → USDC)
 *   • Crypto QR → EIP-681 URI (any EVM wallet sends USDC directly on Base)
 */
export default async function CobrarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/acceso?returnTo=/dashboard/cobrar');
  }

  const network = getStablecoinNetwork('BASE');
  const treasuryAddress = network.treasuryAddress;
  const usdcTokenAddress = network.tokenAddress ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const chainId = network.chainId;

  const transakApiKey = process.env.TRANSAK_API_KEY?.trim() ?? '';
  const transakEnv = (process.env.TRANSAK_ENV ?? 'PRODUCTION').toUpperCase();
  const transakHost =
    transakEnv === 'STAGING' ? 'https://global-stg.transak.com' : 'https://global.transak.com';

  // Build Transak URL (no amount pre-filled — user enters in Transak)
  const transakParams = new URLSearchParams({
    cryptoCurrencyCode: 'USDC',
    network: 'base',
    disableWalletAddressForm: 'true',
    ...(transakApiKey ? { apiKey: transakApiKey } : {}),
    ...(treasuryAddress ? { walletAddress: treasuryAddress } : {})
  });
  const fiatUrl = `${transakHost}/?${transakParams.toString()}`;

  // Build EIP-681 URI for direct USDC transfer on Base
  // ethereum:<USDC_CONTRACT>@<CHAIN_ID>/transfer?address=<TREASURY>&uint256=0
  const cryptoUri = treasuryAddress
    ? `ethereum:${usdcTokenAddress}@${chainId}/transfer?address=${treasuryAddress}`
    : null;

  return (
    <PaymentQRView
      fiatUrl={fiatUrl}
      cryptoUri={cryptoUri}
      treasuryAddress={treasuryAddress}
      chainId={chainId}
      hasFiat={Boolean(transakApiKey && treasuryAddress)}
      hasCrypto={Boolean(treasuryAddress)}
      mpQrConfigured={isMercadoPagoQrConfigured()}
    />
  );
}
