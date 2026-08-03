/**
 * Pure orchestration for CryptoWalletPanel “Pagar” — unit-tested so UI regressions
 * like PRIVY_SESSION_REQUIRED cannot ship without a failing test.
 */

export type SanovaPayServerResult = {
  ok: boolean;
  status?: string;
  error?: string;
  amountUsd?: number;
  balanceUsdc?: number | null;
  batchId?: string;
  txHash?: string;
};

export type CryptoSettleUiOutcome =
  | { kind: 'settled'; batchId?: string; txHash?: string; amountUsd?: number; balanceUsdc?: number | null }
  | { kind: 'waiting_funds'; amountUsd?: number; balanceUsdc?: number | null }
  | {
      kind: 'failed';
      errorCode: string;
      /** Switch checkout tab to external wallet recovery. */
      switchToExternal: boolean;
      amountUsd?: number;
      balanceUsdc?: number | null;
      batchId?: string;
    };

export function isPrivyAuthorizationSignerError(code: string): boolean {
  const lower = code.toLowerCase();
  return (
    code.toUpperCase() === 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED' ||
    lower.includes('no valid authorization keys') ||
    lower.includes('user signing keys available')
  );
}

export function isPrivySessionOrWalletError(code: string): boolean {
  const upper = code.trim().toUpperCase();
  return (
    upper === 'PRIVY_SESSION_REQUIRED' ||
    upper === 'PRIVY_WALLET_NOT_READY' ||
    upper === 'PRIVY_NOT_READY' ||
    upper === 'PRIVY_PROVIDER_UNAVAILABLE' ||
    upper === 'PRIVY_WALLET_ADDRESS_MISMATCH'
  );
}

/** Errors where the user can still pay from Coinbase / WalletConnect. */
export function shouldSwitchToExternalWallet(errorCode: string): boolean {
  const upper = errorCode.trim().toUpperCase();
  return (
    isPrivySessionOrWalletError(upper) ||
    upper === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED' ||
    upper === 'NOT_CONFIGURED' ||
    upper === 'PRIVY_WALLET_ID_NOT_FOUND' ||
    upper === 'PAY_ENDPOINT_NOT_FOUND' ||
    upper === 'INVALID_JSON_RESPONSE' ||
    upper.endsWith('_HTML_RESPONSE')
  );
}

export type CryptoSettleDeps = {
  runServerPay: () => Promise<SanovaPayServerResult>;
  /** Grant app authorization key as signer (needs Privy browser session). */
  grantServerSigner: () => Promise<void>;
  /** Wait until Custom Auth + embedded wallet are ready (no email modal). */
  waitForPrivySession: () => Promise<{ address: string }>;
  /** Client-signed settle (vault/treasury) + cart confirm. */
  settleWithClientPrivy: (batchId: string, amountUsd: number) => Promise<void>;
  ensureBatchId: (preferred?: string | null) => Promise<string | null>;
  /** Expected Sanova receive address (server-linked). */
  expectedWalletAddress: string | null;
};

function errorCodeOf(result: SanovaPayServerResult): string {
  if (result.error === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED' || result.status === 'not_configured') {
    return 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED';
  }
  return result.error ?? result.status ?? 'FAILED';
}

function toFailed(
  errorCode: string,
  extras?: Partial<CryptoSettleUiOutcome & { kind: 'failed' }>
): CryptoSettleUiOutcome {
  return {
    kind: 'failed',
    errorCode,
    switchToExternal: shouldSwitchToExternalWallet(errorCode),
    amountUsd: extras?.amountUsd,
    balanceUsdc: extras?.balanceUsdc,
    batchId: extras?.batchId
  };
}

/**
 * Full Sanova Pay path used by CryptoWalletPanel:
 * 1) server settle
 * 2) if auth-key signer missing → wait Privy session → grant signer → retry server
 * 3) if still blocked → client Privy settle (same wallet)
 * 4) session/wallet failures → external wallet recovery (never raw PRIVY_* in UI alone)
 */
export async function runCryptoWalletSettle(deps: CryptoSettleDeps): Promise<CryptoSettleUiOutcome> {
  let server = await deps.runServerPay();

  if (server.ok && server.status === 'settled') {
    return {
      kind: 'settled',
      batchId: server.batchId,
      txHash: server.txHash,
      amountUsd: server.amountUsd,
      balanceUsdc: server.balanceUsdc
    };
  }

  if (server.status === 'waiting_funds') {
    return {
      kind: 'waiting_funds',
      amountUsd: server.amountUsd,
      balanceUsdc: server.balanceUsdc
    };
  }

  let code = errorCodeOf(server);

  if (!isPrivyAuthorizationSignerError(code)) {
    return toFailed(code, {
      amountUsd: server.amountUsd,
      balanceUsdc: server.balanceUsdc,
      batchId: server.batchId
    });
  }

  // --- Signer missing: hydrate Custom Auth, grant signer, retry server, then client ---
  try {
    const session = await deps.waitForPrivySession();
    const expected = deps.expectedWalletAddress?.trim().toLowerCase() ?? null;
    const actual = session.address.trim().toLowerCase();
    if (expected && actual && expected !== actual) {
      return toFailed('PRIVY_WALLET_ADDRESS_MISMATCH', {
        amountUsd: server.amountUsd,
        balanceUsdc: server.balanceUsdc,
        batchId: server.batchId
      });
    }

    await deps.grantServerSigner();

    server = await deps.runServerPay();
    if (server.ok && server.status === 'settled') {
      return {
        kind: 'settled',
        batchId: server.batchId,
        txHash: server.txHash,
        amountUsd: server.amountUsd,
        balanceUsdc: server.balanceUsdc
      };
    }
    if (server.status === 'waiting_funds') {
      return {
        kind: 'waiting_funds',
        amountUsd: server.amountUsd,
        balanceUsdc: server.balanceUsdc
      };
    }
    code = errorCodeOf(server);

    // After grant+retry, still try client settle when signer remains blocked
    // (or server auto-settle is misconfigured but session can sign).
    if (
      !isPrivyAuthorizationSignerError(code) &&
      code !== 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'
    ) {
      return toFailed(code, {
        amountUsd: server.amountUsd,
        balanceUsdc: server.balanceUsdc,
        batchId: server.batchId
      });
    }

    const batchId = await deps.ensureBatchId(server.batchId);
    if (!batchId) {
      return toFailed('NO_PENDING_PURCHASE', {
        amountUsd: server.amountUsd,
        balanceUsdc: server.balanceUsdc
      });
    }

    const payAmount = server.amountUsd;
    if (typeof payAmount !== 'number' || !(payAmount > 0)) {
      return toFailed(code, {
        amountUsd: server.amountUsd,
        balanceUsdc: server.balanceUsdc,
        batchId
      });
    }

    await deps.settleWithClientPrivy(batchId, payAmount);
    return {
      kind: 'settled',
      batchId,
      amountUsd: payAmount,
      balanceUsdc: server.balanceUsdc
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : code;
    const failedCode = isPrivySessionOrWalletError(message)
      ? message.trim().toUpperCase()
      : isPrivyAuthorizationSignerError(message)
        ? 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED'
        : message;
    return toFailed(failedCode, {
      amountUsd: server.amountUsd,
      balanceUsdc: server.balanceUsdc,
      batchId: server.batchId
    });
  }
}
