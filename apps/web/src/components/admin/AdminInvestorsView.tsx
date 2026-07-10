'use client';

import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Mail, MessageCircle, RefreshCw, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { AdminInvestorRecord } from '../../lib/admin/investorsService';
import type { AdvisorTeamMember } from '../../lib/admin/teamService';
import { KycIdentityDetails } from '../identity/KycIdentityDetails';
import { hasKycIdentityData } from '../../lib/onboarding/extractDiditIdentity';
import { resolveAdminInviteError } from '../../lib/admin/resolveInviteError';
import { AdminGate } from './AdminGate';
import { AdminPendingInvitesPanel } from './AdminPendingInvitesPanel';
import { WhatsAppContactInvitePanel } from './WhatsAppContactInvitePanel';

type KycFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const FILTER_OPTIONS: KycFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

function statusBadgeClass(status: string): string {
  if (status === 'APPROVED') {
    return 'border-terminal-success/30 text-terminal-success';
  }

  if (status === 'REJECTED') {
    return 'border-red-500/30 text-red-400';
  }

  return 'border-terminal-warning/30 text-terminal-warning';
}

export function AdminInvestorsView() {
  const t = useTranslation();
  const { locale, intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [filter, setFilter] = useState<KycFilter>('PENDING');
  const [investors, setInvestors] = useState<AdminInvestorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<AdvisorTeamMember[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteAdvisorId, setInviteAdvisorId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const ai = t.adminInvestors;
  const statusLabels = ai.status as Record<string, string>;
  const filterLabels = ai.filters as Record<KycFilter, string>;

  const identityLabels = t.identityProfile;

  async function handleShareOutreach(userId: string, phone: string | null) {
    if (!phone?.trim()) {
      return;
    }

    setUpdatingId(userId);

    try {
      const response = await fetch(`/api/admin/investors/${userId}/outreach`);
      const data = (await response.json()) as {
        error?: string;
        outreach?: { whatsappUrl?: string | null };
      };

      if (!response.ok || !data.outreach?.whatsappUrl) {
        setInviteMessage(ai.outreachError);
        return;
      }

      window.open(data.outreach.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setInviteMessage(ai.outreachError);
    } finally {
      setUpdatingId(null);
    }
  }

  async function submitInvestorInvite() {
    if (!inviteEmail.trim()) {
      setInviteMessage(ai.inviteError);
      return;
    }

    setInviteLoading(true);
    setInviteMessage(null);

    try {
      const response = await fetch('/api/admin/investors/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          incorporatedByAdvisorId: inviteAdvisorId || null,
          locale
        })
      });

      const data = (await response.json()) as { error?: string; warning?: string };

      if (!response.ok) {
        setInviteMessage(resolveAdminInviteError(data.error, t.adminInviteWhatsApp));
        return;
      }

      setInviteEmail('');
      setInviteName('');
      setInviteAdvisorId('');
      setInviteMessage(
        data.warning === 'INVITE_CREATED_EMAIL_NOT_SENT' ? ai.inviteEmailNotSent : ai.inviteSuccess
      );
      await loadInvestors(filter);
    } catch {
      setInviteMessage(ai.inviteError);
    } finally {
      setInviteLoading(false);
    }
  }

  const loadInvestors = useCallback(async (nextFilter: KycFilter) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`/api/admin/investors?status=${nextFilter}`);
      if (!response.ok) {
        throw new Error('Failed to load investors');
      }

      const data = (await response.json()) as { investors: AdminInvestorRecord[] };
      setInvestors(data.investors);
    } catch {
      setError(true);
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvestors(filter);
  }, [filter, loadInvestors]);

  useEffect(() => {
    void fetch('/api/admin/team/advisors')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { advisors?: AdvisorTeamMember[] } | null) => {
        if (data?.advisors) {
          setAdvisors(data.advisors);
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleAssignAdvisor(userId: string, advisorId: string) {
    if (!advisorId) {
      return;
    }

    setAssigningId(userId);

    try {
      const response = await fetch(`/api/admin/investors/${userId}/advisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisorId })
      });

      if (!response.ok) {
        throw new Error('assign failed');
      }

      await loadInvestors(filter);
    } finally {
      setAssigningId(null);
    }
  }

  async function handleAccessToggle(userId: string, enabled: boolean) {
    setUpdatingId(userId);

    try {
      const response = await fetch(`/api/admin/investors/${userId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error('access update failed');
      }

      await loadInvestors(filter);
    } catch {
      setError(true);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleKycUpdate(userId: string, status: 'APPROVED' | 'REJECTED') {
    setUpdatingId(userId);

    try {
      const response = await fetch(`/api/admin/investors/${userId}/kyc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update KYC');
      }

      await loadInvestors(filter);
    } catch {
      setError(true);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {t.adminDashboard.backToPanel}
        </Link>

        <header className="border-b border-terminal-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {t.adminInvestors.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{t.adminNav.investors}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminDashboard.investorsDesc}</p>
        </header>

        <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-6">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-terminal-primary" />
            <h2 className="text-lg font-semibold text-terminal-text">{ai.inviteTitle}</h2>
          </div>
          <p className="text-sm text-terminal-muted">{ai.inviteDesc}</p>

          {inviteMessage ? (
            <p className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm text-terminal-text">
              {inviteMessage}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm">
              <span className="text-terminal-muted">{ai.inviteEmail}</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
              />
            </label>
            <label className="block text-sm">
              <span className="text-terminal-muted">{ai.inviteName}</span>
              <input
                type="text"
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
              />
            </label>
            <label className="block text-sm">
              <span className="text-terminal-muted">{ai.inviteAdvisor}</span>
              <select
                value={inviteAdvisorId}
                onChange={(event) => setInviteAdvisorId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text"
              >
                <option value="">{ai.inviteAdvisorPlaceholder}</option>
                {advisors.map((advisor) => (
                  <option key={advisor.advisorId} value={advisor.advisorId}>
                    {advisor.email}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={inviteLoading || !inviteEmail.trim()}
            onClick={() => void submitInvestorInvite()}
            className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {inviteLoading ? ai.inviteSubmitting : ai.inviteSubmit}
          </button>

          <WhatsAppContactInvitePanel
            kind="investor"
            advisorId={inviteAdvisorId || undefined}
            onInviteCreated={() => void loadInvestors(filter)}
          />

          <AdminPendingInvitesPanel kind="investor" />
        </section>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === option
                    ? 'border-terminal-primary/40 bg-terminal-bg text-terminal-primary'
                    : 'border-terminal-border text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {filterLabels[option]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadInvestors(filter)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted transition-colors hover:text-terminal-text disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t.adminInvestors.refresh}
          </button>
        </div>

        <section className="space-y-4 md:space-y-0">
          <div className="space-y-3 md:hidden">
            {loading ? (
              <p className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-8 text-center text-sm text-terminal-muted">
                {t.adminInvestors.loading}
              </p>
            ) : error ? (
              <p className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-8 text-center text-sm text-red-400">
                {t.adminInvestors.error}
              </p>
            ) : investors.length === 0 ? (
              <p className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-8 text-center text-sm text-terminal-muted">
                {t.adminInvestors.empty}
              </p>
            ) : (
              investors.map((row) => {
                const displayName = row.kycIdentity.fullName ?? row.investor?.fullName ?? row.name ?? '—';
                const isUpdating = updatingId === row.id;

                return (
                  <article
                    key={row.id}
                    className="rounded-xl border border-terminal-border bg-terminal-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-terminal-text">{displayName}</p>
                        <p className="mt-1 text-xs text-terminal-muted">{row.email}</p>
                        {row.phone ? (
                          <p className="mt-1 font-mono text-xs text-terminal-muted">{row.phone}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded border px-2 py-1 text-[11px] font-semibold ${statusBadgeClass(row.kycStatus)}`}
                      >
                        {statusLabels[row.kycStatus] ?? row.kycStatus}
                      </span>
                    </div>
                    {row.kycStatus === 'PENDING' ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isUpdating || !row.phone}
                          onClick={() => void handleShareOutreach(row.id, row.phone)}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-terminal-primary/30 px-3 py-2 text-xs font-semibold text-terminal-primary disabled:opacity-50"
                        >
                          <MessageCircle size={14} />
                          {row.phone ? ai.shareWhatsApp : ai.shareWhatsAppNoPhone}
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating || !row.contactVerified}
                          onClick={() => void handleKycUpdate(row.id, 'APPROVED')}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-terminal-success/30 px-3 py-2 text-xs font-semibold text-terminal-success"
                        >
                          <Check size={14} />
                          {t.adminInvestors.approve}
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void handleKycUpdate(row.id, 'REJECTED')}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400"
                        >
                          <X size={14} />
                          {t.adminInvestors.reject}
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-terminal-border bg-terminal-card md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colInvestor}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colEmail}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colPhone}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colWallet}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colKyc}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colAccess}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colIdentity}</th>
                  <th className="px-6 py-3 font-semibold">{t.advisorPortal.colAdvisor}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colRegistered}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminInvestors.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminInvestors.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-red-400">
                      {t.adminInvestors.error}
                    </td>
                  </tr>
                ) : investors.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminInvestors.empty}
                    </td>
                  </tr>
                ) : (
                  investors.map((row) => {
                    const displayName = row.kycIdentity.fullName ?? row.investor?.fullName ?? row.name ?? '—';
                    const wallet = row.walletAddress ?? row.investor?.walletAddress ?? '—';
                    const isUpdating = updatingId === row.id;
                    const isExpanded = expandedId === row.id;
                    const hasIdentity = hasKycIdentityData(row.kycIdentity);

                    return (
                      <Fragment key={row.id}>
                      <tr className="transition-colors hover:bg-terminal-bg/60">
                        <td className="px-6 py-4">
                          <p className="font-medium text-terminal-text">{displayName}</p>
                          {row.kycIdentity.documentId ? (
                            <p className="mt-1 text-xs text-terminal-muted">
                              {identityLabels.documentId}: {row.kycIdentity.documentId}
                            </p>
                          ) : row.investor?.cuit ? (
                            <p className="mt-1 text-xs text-terminal-muted">CUIT {row.investor.cuit}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-terminal-muted">{row.email}</td>
                        <td className="px-6 py-4 font-mono text-xs text-terminal-muted">
                          {row.phone ?? '—'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-terminal-muted">
                          {wallet === '—' ? wallet : `${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.kycStatus)}`}
                          >
                            {statusLabels[row.kycStatus] ?? row.kycStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              void handleAccessToggle(row.id, !row.investorAccessEnabled)
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              row.investorAccessEnabled
                                ? 'border-terminal-success/30 text-terminal-success hover:bg-terminal-success/10'
                                : 'border-terminal-warning/30 text-terminal-warning hover:bg-terminal-warning/10'
                            }`}
                          >
                            {row.investorAccessEnabled
                              ? t.adminInvestors.accessEnabled
                              : t.adminInvestors.accessDisabled}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {hasIdentity ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : row.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-medium text-terminal-muted transition-colors hover:text-terminal-text"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isExpanded ? t.adminInvestors.hideIdentity : t.adminInvestors.viewIdentity}
                            </button>
                          ) : (
                            <span className="text-xs text-terminal-muted">{identityLabels.empty}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {row.investor ? (
                            <select
                              disabled={assigningId === row.id || advisors.length === 0}
                              value={row.incorporatedByAdvisorId ?? ''}
                              onChange={(event) =>
                                void handleAssignAdvisor(row.id, event.target.value)
                              }
                              className="max-w-[12rem] rounded-lg border border-terminal-border bg-terminal-bg px-2 py-1 text-xs text-terminal-text"
                            >
                              <option value="">—</option>
                              {advisors.map((advisor) => (
                                <option key={advisor.advisorId} value={advisor.advisorId}>
                                  {advisor.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-terminal-muted">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-terminal-muted">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isUpdating || !row.phone}
                              title={row.phone ? ai.shareWhatsApp : ai.shareWhatsAppNoPhone}
                              onClick={() => void handleShareOutreach(row.id, row.phone)}
                              className="inline-flex items-center gap-1 rounded-lg border border-terminal-primary/30 px-2.5 py-1.5 text-xs font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/10 disabled:opacity-50"
                            >
                              <MessageCircle size={14} />
                              {ai.shareWhatsApp}
                            </button>
                            {row.kycStatus === 'PENDING' ? (
                              <>
                              <button
                                type="button"
                                disabled={isUpdating || !row.contactVerified}
                                title={
                                  row.contactVerified
                                    ? undefined
                                    : t.adminInvestors.contactPendingHint
                                }
                                onClick={() => void handleKycUpdate(row.id, 'APPROVED')}
                                className="inline-flex items-center gap-1 rounded-lg border border-terminal-success/30 px-2.5 py-1.5 text-xs font-semibold text-terminal-success transition-colors hover:bg-terminal-success/10 disabled:opacity-50"
                              >
                                <Check size={14} />
                                {t.adminInvestors.approve}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void handleKycUpdate(row.id, 'REJECTED')}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <X size={14} />
                                {t.adminInvestors.reject}
                              </button>
                              </>
                            ) : (
                              <span className="text-xs text-terminal-muted">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${row.id}-identity`} className="bg-terminal-bg/40">
                          <td colSpan={10} className="px-6 py-4">
                            <KycIdentityDetails
                              identity={row.kycIdentity}
                              labels={identityLabels}
                              className="border-terminal-border bg-terminal-card text-terminal-text"
                            />
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
        </section>
      </div>
    </AdminGate>
  );
}
