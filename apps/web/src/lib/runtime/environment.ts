/** True on Vercel production and NODE_ENV=production runtimes. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/** Demo listings, dividend fallbacks, etc. — off in production unless explicitly allowed. */
export function allowDemoContent(): boolean {
  return !isProductionRuntime() || process.env.ALLOW_DEMO_CONTENT === 'true';
}

/**
 * Demo KYC bypass — allowed in local dev only.
 * ALLOW_DEMO_KYC=true in production is treated as a misconfiguration and
 * throws immediately so it is never silently accepted.
 */
export function allowDemoKyc(): boolean {
  if (isProductionRuntime() && process.env.ALLOW_DEMO_KYC === 'true') {
    throw new Error(
      '[SECURITY] ALLOW_DEMO_KYC=true is set in production. ' +
        'Remove this variable from Vercel immediately — it bypasses all KYC checks.'
    );
  }
  return !isProductionRuntime();
}
