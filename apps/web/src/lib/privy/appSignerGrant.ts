import { privyApiBase, privyHeaders } from './privyHttp';
import { privyAuthorizationKeyQuorumId } from './privyAuthorizationSignature';

/**
 * Whether the app authorization key can already sign for a wallet.
 *
 * The browser used to call `addSigners` on every load and let Privy answer 400
 * when the signer was already there. Our code treated that as success, but the
 * browser still logs the failed request, so every session showed an error that
 * looked like a bug. Asking first keeps the console honest.
 */
export async function walletHasAppSigner(address: string): Promise<boolean | null> {
  const quorumId = privyAuthorizationKeyQuorumId();
  if (!quorumId) {
    return null;
  }

  try {
    const url = new URL(`${privyApiBase()}/v1/wallets`);
    url.searchParams.set('address', address);
    url.searchParams.set('chain_type', 'ethereum');

    const response = await fetch(url.toString(), {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{
        address?: string;
        owner_id?: string | null;
        additional_signers?: Array<{ signer_id?: string }>;
      }>;
    };

    const wallet = (payload.data ?? []).find(
      (row) => row.address?.toLowerCase() === address.toLowerCase()
    );
    if (!wallet) {
      return null;
    }

    if (wallet.owner_id === quorumId) {
      return true;
    }

    return (wallet.additional_signers ?? []).some((row) => row.signer_id?.trim() === quorumId);
  } catch {
    return null;
  }
}
