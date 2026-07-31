export function isMacroClickConfigured(): boolean {
  return Boolean(
    process.env.MACRO_CLICK_GUID?.trim() &&
      process.env.MACRO_CLICK_FRASE?.trim() &&
      process.env.MACRO_CLICK_SECRET_KEY?.trim()
  );
}

export function macroClickEnv(): 'SANDBOX' | 'PRODUCTION' {
  const raw = (process.env.MACRO_CLICK_ENV ?? 'SANDBOX').trim().toUpperCase();
  return raw === 'PRODUCTION' || raw === 'PROD' ? 'PRODUCTION' : 'SANDBOX';
}

export function macroClickApiBaseUrl(): string {
  const override = process.env.MACRO_CLICK_API_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  return macroClickEnv() === 'PRODUCTION'
    ? 'https://botonpp.asjservicios.com.ar:8082/v1'
    : 'https://sandboxpp.asjservicios.com.ar:8082/v1';
}

export function macroClickCheckoutPostUrl(): string {
  const override = process.env.MACRO_CLICK_CHECKOUT_URL?.trim();
  if (override) return override.replace(/\/$/, '') + '/';
  return macroClickEnv() === 'PRODUCTION'
    ? 'https://botonpp.macroclickpago.com.ar/'
    : 'https://sandboxpp.asjservicios.com.ar/';
}

export function macroClickGuid(): string {
  const value = process.env.MACRO_CLICK_GUID?.trim();
  if (!value) throw new Error('MACRO_CLICK_GUID_MISSING');
  return value;
}

export function macroClickFrase(): string {
  const value = process.env.MACRO_CLICK_FRASE?.trim();
  if (!value) throw new Error('MACRO_CLICK_FRASE_MISSING');
  return value;
}

export function macroClickSecretKey(): string {
  const value = process.env.MACRO_CLICK_SECRET_KEY?.trim();
  if (!value) throw new Error('MACRO_CLICK_SECRET_KEY_MISSING');
  return value;
}

export function macroClickBranchId(): string {
  return process.env.MACRO_CLICK_SUCURSAL?.trim() ?? '';
}

/** Código de Ente for Macro “Botón Simple” (debt-search button), if provisioned. */
export function macroClickEnteCode(): string {
  return process.env.MACRO_CLICK_ENTE_CODE?.trim() ?? '';
}

/** Public Botón Simple debt-search URL (sandbox: …:8110/{ente}). Production requires explicit URL. */
export function macroClickDebtSearchUrl(): string | null {
  const override = process.env.MACRO_CLICK_DEBT_SEARCH_URL?.trim();
  if (override) return override;
  const ente = macroClickEnteCode();
  if (!ente || macroClickEnv() === 'PRODUCTION') return null;
  return `https://sandboxpp.asjservicios.com.ar:8110/${ente}`;
}

export function isMacroClickBotonSimpleConfigured(): boolean {
  return Boolean(macroClickEnteCode() || process.env.MACRO_CLICK_DEBT_SEARCH_URL?.trim());
}

/** Public IPs / CIDRs from Click de Pago integration manual (notifications). */
export const MACRO_CLICK_WEBHOOK_CIDRS = [
  '190.210.90.128/27',
  '190.12.117.0/27',
  '190.210.90.160/27',
  '170.150.152.32/27',
  '190.210.103.176/29',
  '200.68.84.72/29',
  '190.104.203.192/28',
  '190.111.243.240/28',
  '200.68.100.193/28',
  '190.104.202.34/28'
] as const;
