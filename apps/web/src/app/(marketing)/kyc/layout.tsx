import { Web3Providers } from '../../../components/providers/providers';

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return <Web3Providers>{children}</Web3Providers>;
}
