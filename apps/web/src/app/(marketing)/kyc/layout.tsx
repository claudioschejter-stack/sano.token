import { Web3Providers } from '../../../components/providers/providers';
import { OnboardingStatusProvider } from '../../../components/providers/OnboardingStatusProvider';

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      <OnboardingStatusProvider>{children}</OnboardingStatusProvider>
    </Web3Providers>
  );
}
