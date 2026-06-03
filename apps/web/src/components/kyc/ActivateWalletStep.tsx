'use client';

import { InvestorWalletLinker } from '../wallet/InvestorWalletLinker';

type ActivateWalletStepProps = {
  onLinked: () => void | Promise<void>;
  onError: (message: string) => void;
};

export function ActivateWalletStep({ onLinked, onError }: ActivateWalletStepProps) {
  return <InvestorWalletLinker variant="onboarding" onLinked={onLinked} onError={onError} />;
}
