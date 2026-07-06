export function shouldStartTotpOnConfirmStep(input: {
  pendingSetup?: boolean;
  storedStep?: 'confirm' | 'backup' | null;
  preferConfirm?: boolean;
}): boolean {
  if (input.preferConfirm) {
    return true;
  }

  if (input.pendingSetup) {
    return true;
  }

  return input.storedStep === 'confirm' || input.storedStep === 'backup';
}

export function initialTotpOnboardingStep(input: {
  isMobile: boolean;
  pendingSetup?: boolean;
  storedStep?: 'confirm' | 'backup' | null;
  preferConfirm?: boolean;
}): 'instructions' | 'provision' | 'confirm' {
  if (
    shouldStartTotpOnConfirmStep({
      pendingSetup: input.pendingSetup,
      storedStep: input.storedStep,
      preferConfirm: input.preferConfirm
    })
  ) {
    return 'confirm';
  }

  return input.isMobile ? 'provision' : 'instructions';
}
