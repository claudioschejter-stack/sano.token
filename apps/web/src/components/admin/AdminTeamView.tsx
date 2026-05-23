'use client';

import Link from 'next/link';
import { ArrowLeft, Check, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type {
  AdvisorNominationRecord,
  AdvisorTeamMember,
  PlatformTeamMember
} from '../../lib/admin/teamService';
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

  const [advisors, setAdvisors] = useState<AdvisorTeamMember[]>([]);
  const [members, setMembers] = useState<PlatformTeamMember[]>([]);
  const [nominations, setNominations] = useState<AdvisorNominationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADVISOR' | 'ADVISOR_MANAGER'>('ADVISOR');
  const [uplineAdvisorId, setUplineAdvisorId] = useState('');

  const managers = useMemo(
    () => advisors.filter((row) => row.systemRole === 'ADVISOR_MANAGER'),
    [advisors]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const [advisorsRes, membersRes, nominationsRes] = await Promise.all([
        fetch('/api/admin/team/advisors'),
        fetch('/api/admin/team/members'),
        fetch('/api/admin/team/nominations?status=PENDING')
      ]);

      if (!advisorsRes.ok || !membersRes.ok || !nominationsRes.ok) {
        throw new Error('load failed');
      }

      const advisorsData = (await advisorsRes.json()) as { advisors: AdvisorTeamMember[] };
      const membersData = (await membersRes.json()) as { members: PlatformTeamMember[] };
      const nominationsData = (await nominationsRes.json()) as {
        nominations: AdvisorNominationRecord[];
      };

      setAdvisors(advisorsData.advisors);
      setMembers(membersData.members);
      setNominations(nominationsData.nominations);
    } catch {
      setError(true);
      setAdvisors([]);
      setMembers([]);
      setNominations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleDesignate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage(null);

    try {
      const response = await fetch('/api/admin/team/advisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          role,
          uplineAdvisorId: role === 'ADVISOR' ? uplineAdvisorId || undefined : null
        })
      });

      if (!response.ok) {
        throw new Error('designate failed');
      }

      setEmail('');
      setName('');
      setUplineAdvisorId('');
      setFormMessage(t.adminTeam.designateSuccess);
      await loadData();
    } catch {
      setFormMessage(t.adminTeam.designateError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(nominationId: string, decision: 'APPROVED' | 'REJECTED') {
    setReviewingId(nominationId);

    try {
      const response = await fetch(`/api/admin/team/nominations/${nominationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });

      if (!response.ok) {
        throw new Error('review failed');
      }

      await loadData();
    } finally {
      setReviewingId(null);
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

        <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-semibold text-terminal-text">{t.adminTeam.designateTitle}</h2>
          <p className="mt-1 text-sm text-terminal-muted">{t.adminTeam.designateDesc}</p>

          <form onSubmit={(event) => void handleDesignate(event)} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-terminal-muted">{t.adminTeam.email}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
              />
            </label>
            <label className="block text-sm">
              <span className="text-terminal-muted">{t.adminTeam.name}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
              />
            </label>
            <label className="block text-sm">
              <span className="text-terminal-muted">{t.adminTeam.role}</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as 'ADVISOR' | 'ADVISOR_MANAGER')}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
              >
                <option value="ADVISOR">{t.adminTeam.roleAdvisor}</option>
                <option value="ADVISOR_MANAGER">{t.adminTeam.roleManager}</option>
              </select>
            </label>
            {role === 'ADVISOR' ? (
              <label className="block text-sm">
                <span className="text-terminal-muted">{t.adminTeam.upline}</span>
                <select
                  required
                  value={uplineAdvisorId}
                  onChange={(event) => setUplineAdvisorId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
                >
                  <option value="">{t.adminTeam.selectUpline}</option>
                  {managers.map((manager) => (
                    <option key={manager.advisorId} value={manager.advisorId}>
                      {manager.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary disabled:opacity-50"
              >
                {submitting ? t.adminTeam.designating : t.adminTeam.designate}
              </button>
              {formMessage ? <p className="text-sm text-terminal-muted">{formMessage}</p> : null}
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-terminal-text">{t.adminTeam.nominationsTitle}</h2>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t.adminTeam.refresh}
            </button>
          </div>
          <p className="text-sm text-terminal-muted">{t.adminTeam.nominationsDesc}</p>

          <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
                  <th className="px-6 py-3">{t.adminTeam.colEmail}</th>
                  <th className="px-6 py-3">{t.adminTeam.colSuggestedBy}</th>
                  <th className="px-6 py-3">{t.adminTeam.colDate}</th>
                  <th className="px-6 py-3">{t.adminInvestors.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {nominations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-terminal-muted">
                      {t.adminTeam.noNominations}
                    </td>
                  </tr>
                ) : (
                  nominations.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-terminal-text">{row.email}</p>
                        {row.name ? <p className="text-xs text-terminal-muted">{row.name}</p> : null}
                      </td>
                      <td className="px-6 py-4 text-terminal-muted">{row.suggestedByEmail}</td>
                      <td className="px-6 py-4 text-terminal-muted">{formatDateTime(row.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={reviewingId === row.id}
                            onClick={() => void handleReview(row.id, 'APPROVED')}
                            className="inline-flex items-center gap-1 rounded-lg border border-terminal-success/30 px-2.5 py-1.5 text-xs text-terminal-success"
                          >
                            <Check size={14} />
                            {t.adminTeam.approve}
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === row.id}
                            onClick={() => void handleReview(row.id, 'REJECTED')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-400"
                          >
                            <X size={14} />
                            {t.adminTeam.reject}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-terminal-text">{t.adminTeam.membersTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{t.adminTeam.membersDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t.adminTeam.refresh}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-terminal-border bg-terminal-card">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
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
                    <td colSpan={9} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminTeam.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-red-400">
                      {t.adminTeam.error}
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminTeam.emptyMembers}
                    </td>
                  </tr>
                ) : (
                  members.map((row) => (
                    <tr key={row.userId}>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminGate>
  );
}
