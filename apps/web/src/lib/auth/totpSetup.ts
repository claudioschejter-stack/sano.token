import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  getTotpUri,
  normalizeTotpSecret
} from './totpService';

export type TotpSetupPayload = {
  uri: string;
  secret: string;
  reused: boolean;
};

export function resolveTotpSetup(input: {
  email: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  force?: boolean;
}): TotpSetupPayload | { error: 'ALREADY_ENABLED' } {
  if (input.totpEnabled) {
    return { error: 'ALREADY_ENABLED' };
  }

  if (input.totpSecret && !input.force) {
    const secret = normalizeTotpSecret(decryptTotpSecret(input.totpSecret));
    return {
      uri: getTotpUri(secret, input.email),
      secret,
      reused: true
    };
  }

  const secret = normalizeTotpSecret(generateTotpSecret());
  return {
    uri: getTotpUri(secret, input.email),
    secret,
    reused: false
  };
}

export function encryptTotpSetupSecret(secret: string): string {
  return encryptTotpSecret(secret);
}
