/** True on Vercel production and NODE_ENV=production runtimes. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/** Demo listings, dividend fallbacks, etc. — off in production unless explicitly allowed. */
export function allowDemoContent(): boolean {
  return !isProductionRuntime() || process.env.ALLOW_DEMO_CONTENT === 'true';
}

/** Demo KYC bypass — local dev only unless ALLOW_DEMO_KYC=true in production. */
export function allowDemoKyc(): boolean {
  return !isProductionRuntime() || process.env.ALLOW_DEMO_KYC === 'true';
}
