export function shouldStartTotpOnConfirmStep(input: {
  preferConfirm?: boolean;
  pendingSetup?: boolean;
  storedStep?: 'confirm' | 'backup' | null;
}): boolean {
  if (input.preferConfirm || input.pendingSetup) {
    return true;
  }

  return input.storedStep === 'confirm' || input.storedStep === 'backup';
}

export function initialTotpOnboardingStep(input: {
  isMobile: boolean;
  preferConfirm?: boolean;
  pendingSetup?: boolean;
  storedStep?: 'confirm' | 'backup' | null;
}): 'instructions' | 'provision' | 'confirm' {
  if (shouldStartTotpOnConfirmStep(input)) {
    return 'confirm';
  }

  return input.isMobile ? 'provision' : 'instructions';
}
