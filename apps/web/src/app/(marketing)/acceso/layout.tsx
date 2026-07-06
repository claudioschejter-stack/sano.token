import { OnboardingStatusProvider } from '../../../components/providers/OnboardingStatusProvider';

export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingStatusProvider>{children}</OnboardingStatusProvider>;
}
