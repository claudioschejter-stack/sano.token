export type CountryDialOption = {
  code: string;
  label: string;
  flag: string;
};

/** Default Argentina — primary market. */
export const COUNTRY_DIAL_CODES: CountryDialOption[] = [
  { code: '+54', label: 'Argentina', flag: '🇦🇷' },
  { code: '+1', label: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+52', label: 'México', flag: '🇲🇽' },
  { code: '+56', label: 'Chile', flag: '🇨🇱' },
  { code: '+57', label: 'Colombia', flag: '🇨🇴' },
  { code: '+51', label: 'Perú', flag: '🇵🇪' },
  { code: '+598', label: 'Uruguay', flag: '🇺🇾' },
  { code: '+55', label: 'Brasil', flag: '🇧🇷' },
  { code: '+34', label: 'España', flag: '🇪🇸' },
  { code: '+49', label: 'Alemania', flag: '🇩🇪' },
  { code: '+33', label: 'Francia', flag: '🇫🇷' },
  { code: '+39', label: 'Italia', flag: '🇮🇹' }
];

export const DEFAULT_DIAL_CODE = '+54';

export function buildE164Phone(dialCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '');
  const codeDigits = dialCode.replace(/\D/g, '');
  return `+${codeDigits}${digits}`;
}

/** Splits E.164 into dial code + local digits for form prefill. */
export function parseE164Phone(e164: string | null | undefined): {
  dialCode: string;
  local: string;
} | null {
  if (!e164?.startsWith('+')) {
    return null;
  }

  const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);

  for (const country of sorted) {
    if (e164.startsWith(country.code)) {
      return {
        dialCode: country.code,
        local: e164.slice(country.code.length).replace(/\D/g, '')
      };
    }
  }

  const match = e164.match(/^(\+\d{1,3})(\d+)$/);
  if (!match) {
    return null;
  }

  return { dialCode: match[1], local: match[2] };
}
