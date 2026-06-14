'use client';

import { MessageCircle, Smartphone, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import {
  isContactPickerAvailable,
  openWhatsAppInvite,
  pickDeviceContacts,
  type PickedContact
} from '../../lib/invite/whatsappInvite';

type InviteRow = PickedContact & {
  emailInput: string;
  status: 'pending' | 'created' | 'error' | 'whatsapp_sent';
  message?: string;
  error?: string;
};

type WhatsAppContactInvitePanelProps = {
  kind: 'investor' | 'team';
  advisorId?: string;
  teamRole?: 'ADVISOR' | 'ADVISOR_MANAGER';
  teamUplineId?: string;
  onInviteCreated?: () => void;
};

export function WhatsAppContactInvitePanel({
  kind,
  advisorId,
  teamRole = 'ADVISOR_MANAGER',
  teamUplineId,
  onInviteCreated
}: WhatsAppContactInvitePanelProps) {
  const t = useTranslation();
  const labels = t.adminInviteWhatsApp;
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const pickerAvailable = isContactPickerAvailable();

  const pickContacts = useCallback(async () => {
    setLoading(true);
    setPanelError(null);

    try {
      const contacts = await pickDeviceContacts();
      setRows(
        contacts.map((contact) => ({
          ...contact,
          emailInput: contact.email,
          status: 'pending'
        }))
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PICK_FAILED';
      setPanelError(code === 'CONTACT_PICKER_UNAVAILABLE' ? labels.pickerUnavailable : labels.pickError);
    } finally {
      setLoading(false);
    }
  }, [labels.pickError, labels.pickerUnavailable]);

  async function createInviteForRow(index: number) {
    const row = rows[index];
    const email = row.emailInput.trim().toLowerCase();
    if (!email) {
      setRows((current) =>
        current.map((item, i) =>
          i === index ? { ...item, status: 'error', error: labels.emailRequired } : item
        )
      );
      return;
    }

    setBusy(true);

    try {
      const endpoint =
        kind === 'investor' ? '/api/admin/investors/invite' : '/api/admin/team/invite';
      const body =
        kind === 'investor'
          ? {
              email,
              name: row.name || undefined,
              incorporatedByAdvisorId: advisorId || null
            }
          : {
              email,
              name: row.name || undefined,
              role: teamRole,
              uplineAdvisorId: teamRole === 'ADVISOR' ? teamUplineId : null
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = (await response.json()) as {
        error?: string;
        invite?: { whatsappMessage?: string };
        whatsappMessage?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'INVITE_FAILED');
      }

      const message = data.invite?.whatsappMessage ?? data.whatsappMessage ?? '';
      setRows((current) =>
        current.map((item, i) =>
          i === index ? { ...item, status: 'created', message, error: undefined } : item
        )
      );
      onInviteCreated?.();
    } catch (error) {
      setRows((current) =>
        current.map((item, i) =>
          i === index
            ? {
                ...item,
                status: 'error',
                error: error instanceof Error ? error.message : labels.createError
              }
            : item
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function createAllInvites() {
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index].status === 'pending' || rows[index].status === 'error') {
        await createInviteForRow(index);
      }
    }
  }

  function sendWhatsApp(index: number) {
    const row = rows[index];
    if (!row.message) {
      return;
    }

    openWhatsAppInvite(row.tel, row.message);
    setRows((current) =>
      current.map((item, i) => (i === index ? { ...item, status: 'whatsapp_sent' } : item))
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircle size={18} className="text-terminal-success" />
        <h3 className="text-sm font-semibold text-terminal-text">{labels.title}</h3>
      </div>
      <p className="mt-2 text-xs text-terminal-muted">{labels.desc}</p>

      {panelError ? (
        <p className="mt-3 text-xs text-red-400">{panelError}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void pickContacts()}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-xs font-semibold text-terminal-text disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
          {pickerAvailable ? labels.pickContacts : labels.pickContactsManual}
        </button>

        <button
          type="button"
          disabled={loading || busy}
          onClick={() =>
            setRows((current) => [
              ...current,
              { name: '', tel: '', email: '', emailInput: '', status: 'pending' }
            ])
          }
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-xs font-semibold text-terminal-text"
        >
          {labels.addManual}
        </button>

        {rows.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void createAllInvites()}
            className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {labels.createAll}
          </button>
        ) : null}
      </div>

      {!pickerAvailable ? (
        <p className="mt-2 text-xs text-terminal-muted">{labels.pickerHint}</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-terminal-muted">
              <tr>
                <th className="py-1 pr-3">{labels.colName}</th>
                <th className="py-1 pr-3">{labels.colPhone}</th>
                <th className="py-1 pr-3">{labels.colEmail}</th>
                <th className="py-1">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {rows.map((row, index) => (
                <tr key={`${row.tel}-${index}`}>
                  <td className="py-2 pr-3">{row.name || '—'}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="tel"
                      value={row.tel}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, tel: event.target.value } : item
                          )
                        )
                      }
                      className="w-full min-w-[8rem] rounded border border-terminal-border bg-terminal-card px-2 py-1 font-mono"
                      placeholder="+54911..."
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="email"
                      value={row.emailInput}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, emailInput: event.target.value } : item
                          )
                        )
                      }
                      className="w-full min-w-[10rem] rounded border border-terminal-border bg-terminal-card px-2 py-1"
                      placeholder={labels.emailPlaceholder}
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {row.status === 'created' || row.status === 'whatsapp_sent' ? (
                        <button
                          type="button"
                          onClick={() => sendWhatsApp(index)}
                          className="rounded border border-terminal-success/40 px-2 py-1 font-semibold text-terminal-success"
                        >
                          {labels.sendWhatsApp}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void createInviteForRow(index)}
                          className="rounded border border-terminal-border px-2 py-1 font-semibold text-terminal-text"
                        >
                          {labels.createInvite}
                        </button>
                      )}
                      {row.error ? <span className="text-red-400">{row.error}</span> : null}
                      {row.status === 'whatsapp_sent' ? (
                        <span className="text-terminal-success">{labels.sent}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
