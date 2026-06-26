import type { Metadata } from 'next';
import { SecuritySettingsView } from '../../../../../components/auth/SecuritySettingsView';

export const metadata: Metadata = {
  title: 'Seguridad — Sanova Capital',
  description: 'Configura la autenticación de dos factores (2FA) para proteger tu cuenta.'
};

export default function SecuritySettingsPage() {
  return <SecuritySettingsView />;
}
