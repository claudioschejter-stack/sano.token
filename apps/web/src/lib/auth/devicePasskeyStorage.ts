const STORAGE_KEY = 'sanova_device_passkey_v1';

export type DevicePasskeyHint = {
  email: string;
  credentialId: string;
};

export function getDevicePasskeyHint(): DevicePasskeyHint | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<DevicePasskeyHint>;
    if (typeof parsed.email === 'string' && typeof parsed.credentialId === 'string') {
      return { email: parsed.email, credentialId: parsed.credentialId };
    }
  } catch {
    /* ignore corrupt storage */
  }

  return null;
}

export function saveDevicePasskeyHint(hint: DevicePasskeyHint): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: hint.email.trim().toLowerCase(),
        credentialId: hint.credentialId
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}
