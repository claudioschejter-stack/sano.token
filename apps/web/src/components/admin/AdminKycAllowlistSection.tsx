'use client';

import { Check, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { AdminAssetRecord } from '../../lib/admin/assetsService';
import type { AdminInvestorRecord } from '../../lib/admin/investorsService';

type AllowlistAssetOption = { id: string; title: string; contractAddress: string };

function statusBadgeClass(status: string): string {
  if (status === 'APPROVED') {
    return 'border-terminal-success/30 text-terminal-success';
  }

  if (status === 'REJECTED') {
    return 'border-red-500/30 text-red-400';
  }

  return 'border-terminal-warning/30 text-terminal-warning';
}

export function AdminKycAllowlistSection() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [allowlistAssets, setAllowlistAssets] = useState<AllowlistAssetOption[]>([]);
  const [selectedAllowlistAssetId, setSelectedAllowlistAssetId] = useState('');
  const [investors, setInvestors] = useState<AdminInvestorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [allowlistingId, setAllowlistingId] = useState<string | null>(null);

  const statusLabels = t.adminInvestors.status as Record<string, string>;
  const labels = t.adminLoans.allowlist;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const [assetsResponse, investorsResponse] = await Promise.all([
        fetch('/api/admin/assets?status=ALL'),
        fetch('/api/admin/investors?status=ALL')
      ]);

      if (!assetsResponse.ok || !investorsResponse.ok) {
        throw new Error('Failed to load allowlist data');
      }

      const assetsData = (await assetsResponse.json()) as { assets: AdminAssetRecord[] };
      const investorsData = (await investorsResponse.json()) as { investors: AdminInvestorRecord[] };

      const nextAssets = assetsData.assets
        .filter((asset) => Boolean(asset.contractAddress))
        .map((asset) => ({
          id: asset.id,
          title: asset.title,
          contractAddress: asset.contractAddress!
        }));

      setAllowlistAssets(nextAssets);
      setSelectedAllowlistAssetId((current) => current || nextAssets[0]?.id || '');
      setInvestors(investorsData.investors.filter((row) => row.kycStatus !== 'PENDING'));
    } catch {
      setError(true);
      setAllowlistAssets([]);
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAllowlistUpdate(userId: string, approved: boolean) {
    if (!selectedAllowlistAssetId) {
      return;
    }

    setAllowlistingId(userId);
    try {
      const response = await fetch(`/api/admin/investors/${userId}/allowlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedAllowlistAssetId, approved })
      });

      if (!response.ok) {
        throw new Error('Allowlist update failed');
      }
    } catch {
      setError(true);
    } finally {
      setAllowlistingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-terminal-text">{labels.title}</p>
          <p className="mt-1 text-xs text-terminal-muted">{labels.description}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted transition-colors hover:text-terminal-text disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {labels.refresh}
        </button>
      </div>

      <select
        value={selectedAllowlistAssetId}
        onChange={(event) => setSelectedAllowlistAssetId(event.target.value)}
        className="mt-3 w-full max-w-xl rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
      >
        <option value="">{labels.noTokens}</option>
        {allowlistAssets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.title} ({asset.contractAddress.slice(0, 6)}...{asset.contractAddress.slice(-4)})
          </option>
        ))}
      </select>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">{t.adminInvestors.colInvestor}</th>
              <th className="px-4 py-3 font-semibold">{t.adminInvestors.colEmail}</th>
              <th className="px-4 py-3 font-semibold">{t.adminInvestors.colWallet}</th>
              <th className="px-4 py-3 font-semibold">{t.adminInvestors.colKyc}</th>
              <th className="px-4 py-3 font-semibold">{t.adminInvestors.colRegistered}</th>
              <th className="px-4 py-3 font-semibold">{t.adminInvestors.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-terminal-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-terminal-muted">
                  {labels.loading}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-400">
                  {labels.error}
                </td>
              </tr>
            ) : investors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-terminal-muted">
                  {labels.empty}
                </td>
              </tr>
            ) : (
              investors.map((row) => {
                const displayName = row.kycIdentity.fullName ?? row.investor?.fullName ?? row.name ?? '—';
                const wallet = row.walletAddress ?? row.investor?.walletAddress ?? '—';

                return (
                  <tr key={row.id} className="transition-colors hover:bg-terminal-bg/60">
                    <td className="px-4 py-3 font-medium text-terminal-text">{displayName}</td>
                    <td className="px-4 py-3 text-terminal-muted">{row.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-terminal-muted">
                      {wallet === '—' ? wallet : `${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.kycStatus)}`}
                      >
                        {statusLabels[row.kycStatus] ?? row.kycStatus}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-terminal-muted">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={allowlistingId === row.id || !selectedAllowlistAssetId || !row.walletAddress}
                          onClick={() => void handleAllowlistUpdate(row.id, true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-terminal-success/30 px-2.5 py-1.5 text-xs font-semibold text-terminal-success transition-colors hover:bg-terminal-success/10 disabled:opacity-50"
                        >
                          <Check size={14} />
                          {labels.allowlist}
                        </button>
                        <button
                          type="button"
                          disabled={allowlistingId === row.id || !selectedAllowlistAssetId || !row.walletAddress}
                          onClick={() => void handleAllowlistUpdate(row.id, false)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <X size={14} />
                          {labels.revoke}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
