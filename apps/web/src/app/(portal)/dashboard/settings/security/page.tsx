import type { Metadata } from 'next';
import { SecuritySettingsView } from '../../../../../components/auth/SecuritySettingsView';
import { resolveServerLocale } from '../../../../../i18n/detectLocaleServer';
import { messagesByLocale } from '../../../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const m = messagesByLocale[locale].legalPagesMeta;
  return {
    title: m.securityTitle,
    description: m.securityDescription
  };
}

export default function SecuritySettingsPage() {
  return <SecuritySettingsView />;
}
