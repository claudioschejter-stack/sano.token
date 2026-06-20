'use client';

import Link from 'next/link';
import { ArrowLeft, Check, RefreshCw, Save, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { AdminSettings } from '../../lib/admin/getAdminSettings';
import type { PlatformConfigFieldSource } from '../../lib/platform/platformConfigService';
import { AdminGate } from './AdminGate';
import { AdminPlatformWalletSection } from './AdminPlatformWalletSection';
import { AdminOAuthSetupSection } from './AdminOAuthSetupSection';

type IntegrationId =
  | 'email'
  | 'kyc'
  | 'googleOAuth'
  | 'appleOAuth'
  | 'walletConnect'
  | 'blockchain'
  | 'redis'
  | 'thirdweb'
  | 'supabaseStorage'
  | 'collateralWebhook'
  | 'morpho';

const INTEGRATION_IDS: IntegrationId[] = [
  'email',
  'kyc',
  'googleOAuth',
  'appleOAuth',
  'walletConnect',
  'blockchain',
  'thirdweb',
  'supabaseStorage',
  'collateralWebhook',
  'morpho',
  'redis'
];

function sourceBadgeClass(source: PlatformConfigFieldSource): string {
  if (source === 'database') {
    return 'border-terminal-primary/30 text-terminal-primary';
  }

  if (source === 'environment') {
    return 'border-terminal-warning/30 text-terminal-warning';
  }

  return 'border-terminal-border text-terminal-muted';
}

function StatusBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active ? 'border-terminal-success/30 text-terminal-success' : 'border-terminal-border text-terminal-muted'
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function AdminSettingsView() {
  const t = useTranslation();
  const integrationLabels = t.adminSettings.integrations as Record<IntegrationId, string>;
  const setupHints = t.adminSettings.integrationSetupHints as Record<IntegrationId, string>;

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [siteUrl, setSiteUrl] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch('/api/admin/settings');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = (await response.json()) as AdminSettings;
      setSettings(data);
      setWhatsappPhone(data.contact.whatsappPhone);
      setContactEmail(data.contact.contactEmail);
      setSiteUrl(data.contact.siteUrl);
    } catch {
      setError(true);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappPhone, contactEmail, siteUrl })
      });

      const data = (await response.json()) as AdminSettings & { error?: string };

      if (!response.ok) {
        if (data.error === 'invalid_whatsapp') {
          setSaveError(t.adminSettings.validationWhatsapp);
        } else if (data.error === 'invalid_email') {
          setSaveError(t.adminSettings.validationEmail);
        } else if (data.error === 'invalid_site_url') {
          setSaveError(t.adminSettings.validationSiteUrl);
        } else {
          setSaveError(t.adminSettings.saveError);
        }
        return;
      }

      setSettings(data);
      setWhatsappPhone(data.contact.whatsappPhone);
      setContactEmail(data.contact.contactEmail);
      setSiteUrl(data.contact.siteUrl);
      setSaveMessage(t.adminSettings.saveSuccess);
    } catch {
      setSaveError(t.adminSettings.saveError);
    } finally {
      setSaving(false);
    }
  }

  const sourceLabels = t.adminSettings.sources as Record<PlatformConfigFieldSource, string>;
  const missingRequired =
    settings?.integrations.filter((item) => !item.configured && !item.optional) ?? [];
  const missingOptional =
    settings?.integrations.filter((item) => !item.configured && item.optional) ?? [];

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {t.adminDashboard.backToPanel}
        </Link>

        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {t.adminDashboard.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{t.adminNav.settings}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminDashboard.settingsDesc}</p>
        </header>

        {loading ? (
          <p className="text-sm text-terminal-muted">{t.adminSettings.loading}</p>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-terminal-card p-6">
            <p className="text-sm text-red-400">{t.adminSettings.error}</p>
            <button
              type="button"
              onClick={() => void loadSettings()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-text transition-colors hover:border-terminal-primary/40"
            >
              <RefreshCw size={16} />
              {t.adminSettings.refresh}
            </button>
          </div>
        ) : settings ? (
          <>
            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <h2 className="text-lg font-semibold text-terminal-text">{t.adminSettings.contactTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{t.adminSettings.contactDesc}</p>

              <form onSubmit={(event) => void handleSave(event)} className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-terminal-muted">{t.adminSettings.whatsappPhone}</span>
                  <input
                    type="text"
                    required
                    value={whatsappPhone}
                    onChange={(event) => setWhatsappPhone(event.target.value)}
                    placeholder="5492617513426"
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
                  />
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${sourceBadgeClass(settings.contact.sources.whatsappPhone)}`}
                  >
                    {sourceLabels[settings.contact.sources.whatsappPhone]}
                  </span>
                </label>

                <label className="block text-sm">
                  <span className="text-terminal-muted">{t.adminSettings.contactEmail}</span>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                  />
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${sourceBadgeClass(settings.contact.sources.contactEmail)}`}
                  >
                    {sourceLabels[settings.contact.sources.contactEmail]}
                  </span>
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className="text-terminal-muted">{t.adminSettings.siteUrl}</span>
                  <input
                    type="url"
                    required
                    value={siteUrl}
                    onChange={(event) => setSiteUrl(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                  />
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${sourceBadgeClass(settings.contact.sources.siteUrl)}`}
                  >
                    {sourceLabels[settings.contact.sources.siteUrl]}
                  </span>
                </label>

                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? t.adminSettings.saving : t.adminSettings.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSettings()}
                    className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-text transition-colors hover:border-terminal-primary/40"
                  >
                    <RefreshCw size={16} />
                    {t.adminSettings.refresh}
                  </button>
                </div>

                {saveMessage ? (
                  <p className="md:col-span-2 flex items-center gap-2 text-sm text-terminal-success">
                    <Check size={16} />
                    {saveMessage}
                  </p>
                ) : null}
                {saveError ? (
                  <p className="md:col-span-2 flex items-center gap-2 text-sm text-red-400">
                    <X size={16} />
                    {saveError}
                  </p>
                ) : null}
              </form>
            </section>

            <AdminPlatformWalletSection />

            <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
              <h2 className="text-lg font-semibold text-terminal-text">{t.adminSettings.integrationsTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{t.adminSettings.integrationsDesc}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {INTEGRATION_IDS.map((id) => {
                  const integration = settings.integrations.find((row) => row.id === id);
                  const configured = integration?.configured ?? false;
                  const optional = integration?.optional ?? false;

                  return (
                    <div
                      key={id}
                      className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-terminal-text">{integrationLabels[id]}</p>
                        {optional ? (
                          <span className="rounded-full border border-terminal-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-terminal-muted">
                            {t.adminSettings.integrationsOptional}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <StatusBadge
                          active={configured}
                          activeLabel={t.adminSettings.configured}
                          inactiveLabel={t.adminSettings.notConfigured}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {missingRequired.length > 0 ? (
                <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
                  <h3 className="text-sm font-semibold text-terminal-text">
                    {t.adminSettings.integrationsMissingTitle}
                  </h3>
                  <p className="mt-1 text-xs text-terminal-muted">{t.adminSettings.integrationsMissingDesc}</p>
                  <ul className="mt-4 space-y-4">
                    {missingRequired.map((item) => (
                      <li key={item.id} className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3">
                        <p className="text-sm font-medium text-terminal-text">
                          {integrationLabels[item.id as IntegrationId]}
                        </p>
                        <p className="mt-2 text-xs text-terminal-muted">
                          {setupHints[item.id as IntegrationId]}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
                          {t.adminSettings.integrationEnvKeys}
                        </p>
                        <p className="mt-1 font-mono text-xs text-terminal-primary">{item.envKeys.join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-6 flex items-center gap-2 text-sm text-terminal-success">
                  <Check size={16} />
                  {t.adminSettings.integrationsAllConfigured}
                </p>
              )}

              {missingOptional.length > 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-terminal-border bg-terminal-bg p-5">
                  <h3 className="text-sm font-semibold text-terminal-text">
                    {t.adminSettings.integrationsOptionalMissingTitle}
                  </h3>
                  <p className="mt-1 text-xs text-terminal-muted">
                    {t.adminSettings.integrationsOptionalMissingDesc}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {missingOptional.map((item) => (
                      <li key={item.id} className="text-sm">
                        <p className="font-medium text-terminal-text">
                          {integrationLabels[item.id as IntegrationId]}
                        </p>
                        <p className="mt-1 text-xs text-terminal-muted">
                          {setupHints[item.id as IntegrationId]}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-terminal-muted">{item.envKeys.join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                <h2 className="text-lg font-semibold text-terminal-text">{t.adminSettings.accessTitle}</h2>
                <p className="mt-1 text-sm text-terminal-muted">{t.adminSettings.accessDesc}</p>

                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="text-terminal-muted">{t.adminSettings.adminEmails}</dt>
                    <dd className="mt-1 text-terminal-text">
                      {settings.access.adminEmails.length > 0 ? (
                        <ul className="space-y-1 font-mono text-xs">
                          {settings.access.adminEmails.map((email) => (
                            <li key={email}>{email}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-terminal-muted">{t.adminSettings.noAdminEmails}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-terminal-muted">{t.adminSettings.oauthGoogle}</dt>
                    <dd>
                      <StatusBadge
                        active={settings.access.oauthGoogle}
                        activeLabel={t.adminSettings.configured}
                        inactiveLabel={t.adminSettings.notConfigured}
                      />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-terminal-muted">{t.adminSettings.oauthApple}</dt>
                    <dd>
                      <StatusBadge
                        active={settings.access.oauthApple}
                        activeLabel={t.adminSettings.configured}
                        inactiveLabel={t.adminSettings.notConfigured}
                      />
                    </dd>
                  </div>
                </dl>

                <AdminOAuthSetupSection
                  siteUrl={siteUrl || settings.contact.siteUrl}
                  oauthGoogle={settings.access.oauthGoogle}
                  oauthApple={settings.access.oauthApple}
                />
              </section>

              <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
                <h2 className="text-lg font-semibold text-terminal-text">{t.adminSettings.operationsTitle}</h2>
                <p className="mt-1 text-sm text-terminal-muted">{t.adminSettings.operationsDesc}</p>

                <dl className="mt-6 space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-terminal-muted">{t.adminSettings.nodeEnv}</dt>
                    <dd className="font-mono text-terminal-text">{settings.operations.nodeEnv}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-terminal-muted">{t.adminSettings.allowDemoKyc}</dt>
                    <dd>
                      <StatusBadge
                        active={settings.operations.allowDemoKyc}
                        activeLabel={t.adminSettings.enabled}
                        inactiveLabel={t.adminSettings.disabled}
                      />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-terminal-muted">{t.adminSettings.bullEnabled}</dt>
                    <dd>
                      <StatusBadge
                        active={settings.operations.bullEnabled}
                        activeLabel={t.adminSettings.enabled}
                        inactiveLabel={t.adminSettings.disabled}
                      />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-terminal-muted">{t.adminSettings.onboardingDevExposeCode}</dt>
                    <dd>
                      <StatusBadge
                        active={settings.operations.onboardingDevExposeCode}
                        activeLabel={t.adminSettings.enabled}
                        inactiveLabel={t.adminSettings.disabled}
                      />
                    </dd>
                  </div>
                </dl>

                <p className="mt-6 rounded-lg border border-dashed border-terminal-border bg-terminal-bg px-4 py-3 text-xs text-terminal-muted">
                  {t.adminSettings.envNote}
                </p>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </AdminGate>
  );
}
