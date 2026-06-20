'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { resolveOAuthCallbackUrl } from '../../lib/auth/oauthProviders';

type AdminOAuthSetupSectionProps = {
  siteUrl: string;
  oauthGoogle: boolean;
  oauthApple: boolean;
};

function CopyButton({ value }: { value: string }) {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1 rounded-md border border-terminal-border px-2 py-1 text-xs text-terminal-muted transition-colors hover:border-terminal-primary/40 hover:text-terminal-text"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t.adminSettings.platformWallet.copied : t.adminSettings.platformWallet.copy}
    </button>
  );
}

export function AdminOAuthSetupSection({
  siteUrl,
  oauthGoogle,
  oauthApple
}: AdminOAuthSetupSectionProps) {
  const t = useTranslation();
  const setup = t.adminSettings.oauthSetup;

  if (oauthGoogle && oauthApple) {
    return null;
  }

  const googleCallback = resolveOAuthCallbackUrl('google', siteUrl);
  const appleCallback = resolveOAuthCallbackUrl('apple', siteUrl);

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
      <div>
        <h3 className="text-sm font-semibold text-terminal-text">{setup.title}</h3>
        <p className="mt-1 text-xs text-terminal-muted">{setup.desc}</p>
      </div>

      {!oauthGoogle ? (
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <p className="text-sm font-medium text-terminal-text">{setup.googleTitle}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-terminal-muted">
            <li>{setup.googleStep1}</li>
            <li>{setup.googleStep2}</li>
            <li>
              {setup.redirectUriLabel}{' '}
              <span className="font-mono text-terminal-primary">{googleCallback}</span>{' '}
              <CopyButton value={googleCallback} />
            </li>
            <li>{setup.googleStep3}</li>
          </ol>
          <p className="mt-3 font-mono text-[11px] text-terminal-muted">AUTH_GOOGLE_ID · AUTH_GOOGLE_SECRET · AUTH_URL</p>
        </div>
      ) : null}

      {!oauthApple ? (
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <p className="text-sm font-medium text-terminal-text">{setup.appleTitle}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-terminal-muted">
            <li>{setup.appleStep1}</li>
            <li>{setup.appleStep2}</li>
            <li>
              {setup.redirectUriLabel}{' '}
              <span className="font-mono text-terminal-primary">{appleCallback}</span>{' '}
              <CopyButton value={appleCallback} />
            </li>
            <li>{setup.appleStep3}</li>
          </ol>
          <p className="mt-3 font-mono text-[11px] text-terminal-muted">AUTH_APPLE_ID · AUTH_APPLE_SECRET · AUTH_URL</p>
        </div>
      ) : null}

      <p className="text-xs text-terminal-muted">{setup.vercelHint}</p>
    </div>
  );
}
