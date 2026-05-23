const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return null;
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain || localPart.length > 64 || domain.includes('..')) {
    return null;
  }

  return email;
}

function normalizeArgentinaNationalDigits(localDigits: string): string | null {
  let digits = localDigits.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Domestic mobile prefix "15" before area code (e.g. 15 261 …)
  if (digits.startsWith('15') && digits.length > 10) {
    digits = digits.slice(2);
  }

  if (!digits.startsWith('9')) {
    digits = `9${digits}`;
  }

  if (digits.length < 10 || digits.length > 11) {
    return null;
  }

  return digits;
}

function validateNationalNumber(countryCode: string, nationalDigits: string): boolean {
  switch (countryCode) {
    case '1':
      return nationalDigits.length === 10;
    case '54':
      return nationalDigits.startsWith('9') && nationalDigits.length >= 10 && nationalDigits.length <= 11;
    case '52':
    case '57':
    case '56':
      return nationalDigits.length >= 9 && nationalDigits.length <= 10;
    case '55':
      return nationalDigits.length >= 10 && nationalDigits.length <= 11;
    default:
      return nationalDigits.length >= 8 && nationalDigits.length <= 12;
  }
}

export function buildAndValidateE164Phone(dialCode: string, localNumber: string): string | null {
  const countryCode = dialCode.replace(/\D/g, '');
  if (!countryCode) {
    return null;
  }

  let nationalDigits = localNumber.replace(/\D/g, '');
  if (!nationalDigits) {
    return null;
  }

  if (countryCode === '54') {
    const normalized = normalizeArgentinaNationalDigits(nationalDigits);
    if (!normalized) {
      return null;
    }
    nationalDigits = normalized;
  } else if (nationalDigits.startsWith('0')) {
    nationalDigits = nationalDigits.replace(/^0+/, '');
  }

  if (!validateNationalNumber(countryCode, nationalDigits)) {
    return null;
  }

  const fullDigits = `${countryCode}${nationalDigits}`;
  if (fullDigits.length < 10 || fullDigits.length > 15) {
    return null;
  }

  return `+${fullDigits}`;
}

function fixArgentinaE164Digits(digits: string): string | null {
  if (!digits.startsWith('54')) {
    return digits;
  }

  if (digits.startsWith('549')) {
    const national = digits.slice(2);
    return validateNationalNumber('54', national) ? digits : null;
  }

  const national = normalizeArgentinaNationalDigits(digits.slice(2));
  if (!national) {
    return null;
  }

  return `54${national}`;
}

export function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  if (trimmed.startsWith('+') || digits.length >= 11) {
    const fixed = fixArgentinaE164Digits(digits);
    return fixed ? `+${fixed}` : null;
  }

  return null;
}
