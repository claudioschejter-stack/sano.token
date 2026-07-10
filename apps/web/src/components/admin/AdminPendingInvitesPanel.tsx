'use client';

import { useCallback, useEffect, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

type PendingInvite = {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  expiresAt: string;
  createdAt: string;
  invitedByEmail: string;
};

type AdminPendingInvitesPanelProps = {
  kind: 'team' | 'investor';
  onChanged?: () => void;
};

export function AdminPendingInvitesPanel({ kind, onChanged }: AdminPendingInvitesPanelProps) {
  const t = useTranslation();
  const labels = t.adminInvites;
  const { locale, intlLocale } = useLocale();
  const { formatDateTime } = createIntlFormatters(intlLocale);

  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const listUrl =
    kind === 'team' ? '/api/admin/team/invites' : '/api/admin/investors/invites';
  const cancelUrl = (id: string) =>
    kind === 'team'
      ? `/api/admin/team/invites/${id}/cancel`
      : `/api/admin/investors/invites/${id}/cancel`;
  const resendUrl = (id: string) =>
    kind === 'team'
      ? `/api/admin/team/invites/${id}/resend`
      : `/api/admin/investors/invites/${id}/resend`;

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(listUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('load failed');
      }
      const data = (await response.json()) as { invites: PendingInvite[] };
      setInvites(data.invites ?? []);
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function cancelInvite(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch(cancelUrl(id), { method: 'POST' });
      if (!response.ok) {
        throw new Error('cancel failed');
      }
      setMessage(labels.cancelSuccess);
      await loadInvites();
      onChanged?.();
    } catch {
      setMessage(labels.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch(resendUrl(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale })
      });
      const data = (await response.json()) as { warning?: string };
      if (!response.ok) {
        throw new Error('resend failed');
      }
      setMessage(
        data.warning === 'INVITE_CREATED_EMAIL_NOT_SENT' ? labels.resendEmailNotSent : labels.resendSuccess
      );
      await loadInvites();
    } catch {
      setMessage(labels.actionError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-terminal-border bg-terminal-card p-4">
      <h3 className="text-sm font-semibold text-terminal-text">{labels.pendingTitle}</h3>
      <p className="mt-1 text-xs text-terminal-muted">{labels.pendingDesc}</p>

      {message ? <p className="mt-3 text-xs text-terminal-muted">{message}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-terminal-muted">{labels.loading}</p>
      ) : invites.length === 0 ? (
        <p className="mt-4 text-sm text-terminal-muted">{labels.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-terminal-muted">
              <tr>
                <th className="py-2 pr-3">{labels.colEmail}</th>
                <th className="py-2 pr-3">{labels.colName}</th>
                {kind === 'team' ? <th className="py-2 pr-3">{labels.colRole}</th> : null}
                <th className="py-2 pr-3">{labels.colInvitedBy}</th>
                <th className="py-2 pr-3">{labels.colExpires}</th>
                <th className="py-2">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td className="py-2 pr-3 font-mono">{invite.email}</td>
                  <td className="py-2 pr-3">{invite.name ?? '—'}</td>
                  {kind === 'team' ? (
                    <td className="py-2 pr-3">{invite.role ?? '—'}</td>
                  ) : null}
                  <td className="py-2 pr-3 text-terminal-muted">{invite.invitedByEmail}</td>
                  <td className="py-2 pr-3 text-terminal-muted">
                    {formatDateTime(invite.expiresAt)}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === invite.id}
                        onClick={() => void resendInvite(invite.id)}
                        className="rounded border border-terminal-border px-2 py-1 font-semibold text-terminal-text"
                      >
                        {labels.resend}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === invite.id}
                        onClick={() => void cancelInvite(invite.id)}
                        className="rounded border border-red-500/40 px-2 py-1 font-semibold text-red-400"
                      >
                        {labels.cancel}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
