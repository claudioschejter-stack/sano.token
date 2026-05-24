'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { PlatformTeamMember } from '../../lib/admin/teamService';
import type { SystemRole } from '../../lib/auth/roles';
import { AdminGate } from './AdminGate';

function VerificationCell({
  verified,
  verifiedAt,
  pendingLabel,
  formatDateTime
}: {
  verified: boolean;
  verifiedAt: string | null;
  pendingLabel: string;
  formatDateTime: (value: string) => string;
}) {
  if (!verified) {
    return <span className="text-terminal-muted">{pendingLabel}</span>;
  }

  return (
    <span className="inline-flex flex-col text-terminal-success">
      <span className="font-medium">✓</span>
      {verifiedAt ? (
        <span className="text-xs text-terminal-muted">{formatDateTime(verifiedAt)}</span>
      ) : null}
    </span>
  );
}

export function AdminTeamView() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const roleLabels = t.access.roles;

  const [members, setMembers] = useState<PlatformTeamMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editingMember, setEditingMember] = useState<PlatformTeamMember | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    fullName: '',
    identification: '',
    phone: '',
    systemRole: 'INVESTOR' as SystemRole
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const selectedCount = selectedUserIds.length;
  const allMembersSelected = members.length > 0 && selectedCount === members.length;
  const roleOptions: SystemRole[] = [
    'ADMIN',
    'ADVISOR_MANAGER',
    'ADVISOR',
    'INVESTOR',
    'TREASURY',
    'OPERATOR'
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch('/api/admin/team/members');

      if (!response.ok) {
        throw new Error('load failed');
      }

      const data = (await response.json()) as { members: PlatformTeamMember[] };
      setMembers(data.members);
      setSelectedUserIds((current) =>
        current.filter((userId) => data.members.some((member) => member.userId === userId))
      );
    } catch {
      setError(true);
      setMembers([]);
      setSelectedUserIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((selectedId) => selectedId !== userId)
        : [...current, userId]
    );
  }

  function toggleAllUsers() {
    setSelectedUserIds(allMembersSelected ? [] : members.map((member) => member.userId));
  }

  function openEditForm() {
    const member = members.find((row) => row.userId === selectedUserIds[0]);
    if (!member) {
      return;
    }

    setEditingMember(member);
    setEditForm({
      email: member.email,
      fullName: member.fullName ?? '',
      identification: member.identification ?? '',
      phone: member.phone ?? '',
      systemRole: member.systemRole
    });
    setActionMessage(null);
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMember || !window.confirm(t.adminTeam.confirmEdit)) {
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch('/api/admin/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingMember.userId,
          ...editForm
        })
      });

      if (!response.ok) {
        throw new Error('edit failed');
      }

      setEditingMember(null);
      setSelectedUserIds([]);
      setActionMessage(t.adminTeam.editSuccess);
      await loadData();
    } catch {
      setActionMessage(t.adminTeam.editError);
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteSelectedUsers() {
    if (selectedCount === 0) {
      return;
    }

    const selectedEmails = members
      .filter((member) => selectedUserIds.includes(member.userId))
      .map((member) => member.email)
      .join('\n');

    const confirmed = window.confirm(
      `${t.adminTeam.confirmDelete}\n\n${selectedEmails}`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch('/api/admin/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'CANNOT_DELETE_SELF') {
          setActionMessage(t.adminTeam.deleteSelfError);
          return;
        }

        throw new Error('delete failed');
      }

      setSelectedUserIds([]);
      setActionMessage(t.adminTeam.deleteSuccess);
      await loadData();
    } catch {
      setActionMessage(t.adminTeam.deleteError);
    } finally {
      setActionLoading(false);
    }
  }

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
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{t.adminNav.team}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminDashboard.teamDesc}</p>
        </header>

        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-terminal-text">{t.adminTeam.membersTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{t.adminTeam.membersDesc}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAllUsers}
                disabled={loading || members.length === 0}
                className="rounded-lg border border-terminal-border px-3 py-2 text-sm font-medium text-terminal-text transition-colors hover:border-terminal-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allMembersSelected ? t.adminTeam.clearSelection : t.adminTeam.selectUsers}
              </button>
              <button
                type="button"
                onClick={openEditForm}
                disabled={selectedCount !== 1}
                className="rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-2 text-sm font-semibold text-terminal-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.adminTeam.editSelected}
              </button>
              <button
                type="button"
                onClick={() => void deleteSelectedUsers()}
                disabled={selectedCount === 0 || actionLoading}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.adminTeam.deleteSelected}
              </button>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {t.adminTeam.refresh}
              </button>
            </div>
          </div>

          {actionMessage ? (
            <p className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm text-terminal-muted">
              {actionMessage}
            </p>
          ) : null}

          {editingMember ? (
            <form
              onSubmit={(event) => void submitEdit(event)}
              className="grid gap-4 rounded-xl border border-terminal-border bg-terminal-card p-4 md:grid-cols-2"
            >
              <div className="md:col-span-2 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-terminal-text">{t.adminTeam.editTitle}</h3>
                  <p className="mt-1 text-sm text-terminal-muted">{editingMember.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted"
                >
                  {t.adminTeam.cancel}
                </button>
              </div>

              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.colEmail}</span>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                />
              </label>

              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.colFullName}</span>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                />
              </label>

              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.colIdentification}</span>
                <input
                  type="text"
                  value={editForm.identification}
                  onChange={(event) => setEditForm((current) => ({ ...current, identification: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                />
              </label>

              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.colPhone}</span>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+5492617513426"
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                />
              </label>

              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.colRole}</span>
                <select
                  value={editForm.systemRole}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, systemRole: event.target.value as SystemRole }))
                  }
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role] ?? role}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary disabled:opacity-50"
                >
                  {actionLoading ? t.adminTeam.saving : t.adminTeam.saveChanges}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  disabled={actionLoading}
                  className="rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-muted disabled:opacity-50"
                >
                  {t.adminTeam.cancel}
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-terminal-border bg-terminal-card">
            <table className="min-w-[1040px] w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">{t.adminTeam.selectUsers}</span>
                  </th>
                  <th className="px-4 py-3">{t.adminTeam.colFullName}</th>
                  <th className="px-4 py-3">{t.adminTeam.colIdentification}</th>
                  <th className="px-4 py-3">{t.adminTeam.colEmail}</th>
                  <th className="px-4 py-3">{t.adminTeam.colEmailVerified}</th>
                  <th className="px-4 py-3">{t.adminTeam.colPhone}</th>
                  <th className="px-4 py-3">{t.adminTeam.colPhoneVerified}</th>
                  <th className="px-4 py-3">{t.adminTeam.colRole}</th>
                  <th className="px-4 py-3">{t.adminTeam.colUpline}</th>
                  <th className="px-4 py-3">{t.adminTeam.colClients}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminTeam.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-red-400">
                      {t.adminTeam.error}
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminTeam.emptyMembers}
                    </td>
                  </tr>
                ) : (
                  members.map((row) => {
                    const selected = selectedUserIds.includes(row.userId);

                    return (
                      <tr
                        key={row.userId}
                        className={selected ? 'bg-terminal-primary/5' : undefined}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleUserSelection(row.userId)}
                            aria-label={`${t.adminTeam.selectUsers}: ${row.email}`}
                            className="h-4 w-4 rounded border-terminal-border bg-terminal-bg text-terminal-primary"
                          />
                        </td>
                        <td className="px-4 py-4 font-medium text-terminal-text">
                          {row.fullName ?? '—'}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-terminal-muted">
                          {row.identification ?? '—'}
                        </td>
                        <td className="px-4 py-4 text-terminal-text">{row.email}</td>
                        <td className="px-4 py-4">
                          <VerificationCell
                            verified={row.emailVerified}
                            verifiedAt={row.emailVerifiedAt}
                            pendingLabel={t.adminTeam.verificationPending}
                            formatDateTime={formatDateTime}
                          />
                        </td>
                        <td className="px-4 py-4 text-terminal-muted">{row.phone ?? '—'}</td>
                        <td className="px-4 py-4">
                          <VerificationCell
                            verified={row.phoneVerified}
                            verifiedAt={row.phoneVerifiedAt}
                            pendingLabel={t.adminTeam.verificationPending}
                            formatDateTime={formatDateTime}
                          />
                        </td>
                        <td className="px-4 py-4 text-terminal-muted">
                          {roleLabels[row.systemRole] ?? row.systemRole}
                        </td>
                        <td className="px-4 py-4 text-terminal-muted">{row.uplineEmail ?? '—'}</td>
                        <td className="px-4 py-4 text-terminal-muted">
                          {row.incorporatedInvestors ?? '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminGate>
  );
}
