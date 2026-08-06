/**
 * Keep the deposit webhook watching every investor wallet.
 *
 * Alchemy's Address Activity webhook notifies transfers for a list of addresses,
 * so an investor whose wallet is not on the list is invisible to it — their
 * deposit would fall back to the block scan, which only looks at a recent
 * window. A wallet created today and funded next week would land in the gap.
 *
 * So the list is maintained where wallets are created, not by hand. Failing to
 * register is never fatal: the scan still exists as the slower path, and a
 * missed registration must not stop an investor from getting a wallet.
 */

const UPDATE_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';

/** Alchemy caps a single request at 500 addresses. */
const MAX_PER_REQUEST = 500;

export function isAlchemyWebhookManaged(): boolean {
  return Boolean(
    process.env.ALCHEMY_NOTIFY_AUTH_TOKEN?.trim() && process.env.ALCHEMY_WEBHOOK_ID?.trim()
  );
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

export type WatchAddressesResult =
  | { ok: true; added: number; skipped?: 'NOT_CONFIGURED' }
  | { ok: false; error: string };

/**
 * Add addresses to the webhook. Idempotent on Alchemy's side, so re-adding an
 * address that is already watched costs a request and changes nothing.
 */
export async function watchAddressesForDeposits(
  addresses: string[]
): Promise<WatchAddressesResult> {
  const unique = [
    ...new Set(addresses.map((row) => row?.trim()).filter((row): row is string => Boolean(row)))
  ];
  if (unique.length === 0) {
    return { ok: true, added: 0 };
  }
  if (!isAlchemyWebhookManaged()) {
    return { ok: true, added: 0, skipped: 'NOT_CONFIGURED' };
  }

  const token = process.env.ALCHEMY_NOTIFY_AUTH_TOKEN!.trim();
  const webhookId = process.env.ALCHEMY_WEBHOOK_ID!.trim();

  try {
    for (const batch of chunk(unique, MAX_PER_REQUEST)) {
      const response = await fetch(UPDATE_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Alchemy-Token': token },
        body: JSON.stringify({
          webhook_id: webhookId,
          addresses_to_add: batch,
          addresses_to_remove: []
        })
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => response.statusText);
        return { ok: false, error: `ALCHEMY_${response.status}: ${detail.slice(0, 200)}` };
      }
    }

    return { ok: true, added: unique.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 200) : 'ALCHEMY_UPDATE_FAILED'
    };
  }
}

/** Register one wallet, without letting a failure reach the caller. */
export async function watchInvestorWalletForDeposits(address: string | null | undefined): Promise<void> {
  if (!address?.trim()) return;

  const result = await watchAddressesForDeposits([address]).catch((error) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : 'ALCHEMY_UPDATE_FAILED'
  }));

  if (result.ok === false) {
    // The block scan still covers this wallet, more slowly.
    console.error('[alchemyWebhookAddresses] could not watch', address, result.error);
  }
}
