import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import { getStablecoinNetwork } from '../../../../lib/payments/stablecoinNetworks';
import { isMercadoPagoQrConfigured } from '../../../../lib/payments/mercadoPagoQr/config';
import { PaymentQRView } from '../../../../components/payment/PaymentQRView';

/**
 * "Cobrar" page — the QR codes an operator can show to receive a payment:
 *   • Crypto QR → EIP-681 URI (any EVM wallet sends USDC directly on Base)
 *   • Mercado Pago QR → in-person peso collection, settled by its own webhook
 *
 * A card/bank QR is not offered here: Macro's hosted checkout needs an amount
 * and a reference to post, so it cannot be reduced to a static image. Cards go
 * through the checkout, which creates that reference.
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

  // Build EIP-681 URI for direct USDC transfer on Base
  // ethereum:<USDC_CONTRACT>@<CHAIN_ID>/transfer?address=<TREASURY>&uint256=0
  const cryptoUri = treasuryAddress
    ? `ethereum:${usdcTokenAddress}@${chainId}/transfer?address=${treasuryAddress}`
    : null;

  return (
    <PaymentQRView
      cryptoUri={cryptoUri}
      treasuryAddress={treasuryAddress}
      chainId={chainId}
      hasCrypto={Boolean(treasuryAddress)}
      mpQrConfigured={isMercadoPagoQrConfigured()}
    />
  );
}
