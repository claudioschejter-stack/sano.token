const STORAGE_KEY = 'sanova_biometric_prompt_shown_v1';

function readShownEmails(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

/** True once we've offered the "Activar biometría" toggle to this email on this device,
 * regardless of whether the user enabled it or skipped it — the prompt is shown once. */
export function hasBiometricPromptBeenShown(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return readShownEmails().includes(normalized);
}

export function markBiometricPromptShown(email: string): void {
  const normalized = email.trim().toLowerCase();
  if (typeof window === 'undefined' || !normalized) {
    return;
  }

  try {
    const shown = new Set(readShownEmails());
    shown.add(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(shown)));
  } catch {
    /* ignore quota / private mode */
  }
}
