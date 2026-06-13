'use client';

import Link from 'next/link';
import { ArrowLeft, Banknote, ExternalLink, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, Fragment, type Dispatch, type SetStateAction } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { Messages } from '../../i18n/locales/en';
import type { AdminAssetRecord } from '../../lib/admin/assetsService';
import {
  isMorphoBorrowReadyAsset,
  isMorphoCollateralAsset
} from '../../lib/admin/assetsService';
import { AdminGate } from './AdminGate';

type AssetFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'MORPHO_READY';

const FILTER_OPTIONS: AssetFilter[] = ['ALL', 'ACTIVE', 'INACTIVE', 'MORPHO_READY'];

type EditDraft = {
  availableTokens: string;
  pricePerToken: string;
};

type AdminAssetsTableProps = {
  title: string;
  emptyMessage: string;
  assets: AdminAssetRecord[];
  loading: boolean;
  error: boolean;
  intlLocale: string;
  formatUsd: (value: number) => string;
  formatPercent: (value: number) => string;
  t: Messages;
  updatingId: string | null;
  editingId: string | null;
  editDraft: EditDraft;
  deleteConfirmId: string | null;
  setEditDraft: Dispatch<SetStateAction<EditDraft>>;
  setDeleteConfirmId: Dispatch<SetStateAction<string | null>>;
  onPatch: (projectId: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  onStartEdit: (asset: AdminAssetRecord) => void;
  onCancelEdit: () => void;
  onSaveEdit: (projectId: string) => Promise<void>;
};

function AdminAssetsTable({
  title,
  emptyMessage,
  assets,
  loading,
  error,
  intlLocale,
  formatUsd,
  formatPercent,
  t,
  updatingId,
  editingId,
  editDraft,
  deleteConfirmId,
  setEditDraft,
  setDeleteConfirmId,
  onPatch,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onSaveEdit
}: AdminAssetsTableProps) {
  const statusLabels = t.adminAssets.status as Record<'ACTIVE' | 'INACTIVE', string>;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-terminal-text">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
              <tr>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colAsset}</th>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colLocation}</th>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colPrice}</th>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colSupply}</th>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colYield}</th>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colStatus}</th>
                <th className="px-6 py-3 font-semibold">{t.adminAssets.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-terminal-muted">
                    {t.adminAssets.loading}
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-red-400">
                    {t.adminAssets.error}
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-terminal-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  const isUpdating = updatingId === asset.id;
                  const isEditing = editingId === asset.id;
                  const statusKey = asset.isActive ? 'ACTIVE' : 'INACTIVE';
                  const canDelete = !asset.isActive && asset.activeInvestments === 0;

                  return (
                    <Fragment key={asset.id}>
                      <tr className="transition-colors hover:bg-terminal-bg/60">
                        <td className="px-6 py-4">
                          <p className="font-medium text-terminal-text">{asset.title}</p>
                          <p className="mt-1 font-mono text-xs text-terminal-muted">{asset.tokenSymbol}</p>
                          {asset.activeInvestments > 0 ? (
                            <p className="mt-1 text-xs text-terminal-muted">
                              {t.adminAssets.activeInvestments.replace(
                                '{count}',
                                String(asset.activeInvestments)
                              )}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-xs px-6 py-4 text-terminal-muted">{asset.location}</td>
                        <td className="px-6 py-4 font-mono text-terminal-text">
                          {formatUsd(asset.pricePerToken)}
                        </td>
                        <td className="px-6 py-4 text-terminal-muted">
                          {asset.availableTokens.toLocaleString(intlLocale)} /{' '}
                          {asset.totalTokens.toLocaleString(intlLocale)}
                          <p className="mt-1 text-xs">
                            {asset.soldPercent}% {t.adminAssets.sold}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-mono text-terminal-accent">
                          {formatPercent(asset.targetYield)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${
                              asset.isActive
                                ? 'border-terminal-success/30 text-terminal-success'
                                : 'border-terminal-border text-terminal-muted'
                            }`}
                          >
                            {statusLabels[statusKey]}
                          </span>
                          {isMorphoCollateralAsset(asset) ? (
                            <p
                              className={`mt-2 text-xs font-semibold ${
                                isMorphoBorrowReadyAsset(asset)
                                  ? 'text-terminal-success'
                                  : 'text-terminal-warning'
                              }`}
                            >
                              {isMorphoBorrowReadyAsset(asset)
                                ? t.adminAssets.morphoReadyBadge
                                : t.adminAssets.morphoPendingBadge}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void onPatch(asset.id, { isActive: !asset.isActive })}
                              className="rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary disabled:opacity-50"
                            >
                              {asset.isActive ? t.adminAssets.unpublish : t.adminAssets.publish}
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => (isEditing ? onCancelEdit() : onStartEdit(asset))}
                              className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-text disabled:opacity-50"
                            >
                              {isEditing ? <X size={14} /> : <Pencil size={14} />}
                              {isEditing ? t.adminAssets.cancel : t.adminAssets.edit}
                            </button>
                            <Link
                              href={`/dashboard/assets/${asset.id}/edit`}
                              className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-primary"
                            >
                              <Pencil size={14} />
                              {t.adminAssets.editLaunch}
                            </Link>
                            <Link
                              href={`/dashboard/assets/${asset.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-2.5 py-1.5 text-xs font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/20"
                            >
                              <Banknote size={14} />
                              {t.adminAssets.manageRent}
                            </Link>
                            {isMorphoCollateralAsset(asset) ? (
                              <Link
                                href={`/dashboard/loans/${asset.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-primary"
                              >
                                {t.adminAssets.configureLoan}
                              </Link>
                            ) : null}
                            <Link
                              href={`/marketplace/${asset.id}/checkout`}
                              className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-primary"
                            >
                              <ExternalLink size={14} />
                              {t.adminAssets.view}
                            </Link>
                            {canDelete ? (
                              deleteConfirmId === asset.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => void onDelete(asset.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
                                  >
                                    <Trash2 size={14} />
                                    {t.adminAssets.confirmDelete}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs text-terminal-muted"
                                  >
                                    {t.adminAssets.cancel}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => setDeleteConfirmId(asset.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  {t.adminAssets.delete}
                                </button>
                              )
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isEditing ? (
                        <tr className="bg-terminal-bg/40">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              <label className="block text-sm">
                                <span className="mb-1.5 block text-terminal-muted">
                                  {t.adminAssets.fieldAvailableTokens}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={asset.totalTokens}
                                  value={editDraft.availableTokens}
                                  onChange={(event) =>
                                    setEditDraft((current) => ({
                                      ...current,
                                      availableTokens: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-terminal-text outline-none focus:border-terminal-primary"
                                />
                              </label>
                              <label className="block text-sm">
                                <span className="mb-1.5 block text-terminal-muted">
                                  {t.adminAssets.fieldPricePerToken}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={editDraft.pricePerToken}
                                  onChange={(event) =>
                                    setEditDraft((current) => ({
                                      ...current,
                                      pricePerToken: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-terminal-text outline-none focus:border-terminal-primary"
                                />
                              </label>
                              <div className="flex items-end">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => void onSaveEdit(asset.id)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-bg px-4 py-2 text-sm font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/10 disabled:opacity-50"
                                >
                                  <Save size={16} />
                                  {t.adminAssets.save}
                                </button>
                              </div>
                            </div>
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
  );
}

export function AdminAssetsView() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd, formatPercent } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);

  const [filter, setFilter] = useState<AssetFilter>('ALL');
  const [assets, setAssets] = useState<AdminAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ availableTokens: '', pricePerToken: '' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filterLabels = t.adminAssets.filters as Record<AssetFilter, string>;

  const { debtAssets, equityAssets, morphoReadyAssets } = useMemo(() => {
    const filtered =
      filter === 'MORPHO_READY' ? assets.filter((asset) => isMorphoBorrowReadyAsset(asset)) : assets;

    return {
      debtAssets: filtered.filter((asset) => asset.tokenInstrumentType === 'DEBT'),
      equityAssets: filtered.filter((asset) => asset.tokenInstrumentType !== 'DEBT'),
      morphoReadyAssets: assets.filter((asset) => isMorphoBorrowReadyAsset(asset))
    };
  }, [assets, filter]);

  const loadAssets = useCallback(async (nextFilter: AssetFilter) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`/api/admin/assets?status=${nextFilter}`);
      if (!response.ok) {
        throw new Error('Failed to load assets');
      }

      const data = (await response.json()) as { assets: AdminAssetRecord[] };
      setAssets(data.assets);
    } catch {
      setError(true);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets(filter);
  }, [filter, loadAssets]);

  async function patchAsset(projectId: string, body: Record<string, unknown>) {
    setUpdatingId(projectId);
    setSaveError(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('Failed to update asset');
      }

      await loadAssets(filter);
      setEditingId(null);
    } catch {
      setSaveError(t.adminAssets.saveError);
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteAsset(projectId: string) {
    setUpdatingId(projectId);
    setSaveError(null);

    try {
      const response = await fetch(`/api/admin/assets/${projectId}`, { method: 'DELETE' });
      const data = (await response.json()) as { error?: string; code?: string };

      if (!response.ok) {
        if (data.code === 'ACTIVE_INVESTMENTS') {
          setSaveError(t.adminAssets.deleteBlockedInvestments);
        } else if (data.code === 'ASSET_PUBLISHED') {
          setSaveError(t.adminAssets.deleteBlockedPublished);
        } else {
          setSaveError(t.adminAssets.deleteError);
        }
        return;
      }

      setDeleteConfirmId(null);
      await loadAssets(filter);
    } catch {
      setSaveError(t.adminAssets.deleteError);
    } finally {
      setUpdatingId(null);
    }
  }

  function startEdit(asset: AdminAssetRecord) {
    setEditingId(asset.id);
    setSaveError(null);
    setEditDraft({
      availableTokens: String(asset.availableTokens),
      pricePerToken: String(asset.pricePerToken)
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function saveEdit(projectId: string) {
    const availableTokens = Number.parseInt(editDraft.availableTokens, 10);
    const pricePerToken = Number.parseFloat(editDraft.pricePerToken);

    if (!Number.isInteger(availableTokens) || availableTokens < 0) {
      setSaveError(t.adminAssets.validationTokens);
      return;
    }

    if (!Number.isFinite(pricePerToken) || pricePerToken <= 0) {
      setSaveError(t.adminAssets.validationPrice);
      return;
    }

    await patchAsset(projectId, { availableTokens, pricePerToken });
  }

  const tableProps = {
    loading,
    error,
    intlLocale,
    formatUsd,
    formatPercent,
    t,
    updatingId,
    editingId,
    editDraft,
    deleteConfirmId,
    setEditDraft,
    setDeleteConfirmId,
    onPatch: patchAsset,
    onDelete: deleteAsset,
    onStartEdit: startEdit,
    onCancelEdit: cancelEdit,
    onSaveEdit: saveEdit
  };

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
            {t.adminAssets.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-terminal-text">{t.adminNav.assets}</h1>
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminAssets.subtitle}</p>
        </header>

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

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/assets/new"
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-bg px-3 py-2 text-sm font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/10"
            >
              <Plus size={16} />
              {t.adminAssets.newLaunch}
            </Link>
            <button
              type="button"
              onClick={() => void loadAssets(filter)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted transition-colors hover:text-terminal-text disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t.adminAssets.refresh}
            </button>
          </div>
        </div>

        {saveError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{saveError}</p>
        ) : null}

        <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">
                {t.adminAssets.sectionMorphoReady}
              </p>
              <p className="mt-1 text-sm text-terminal-muted">{t.adminAssets.sectionMorphoReadyHint}</p>
            </div>
            <p className="text-sm text-terminal-muted">
              <span className="font-mono text-terminal-success">{morphoReadyAssets.length}</span>
              / {assets.length}
            </p>
          </div>
          {morphoReadyAssets.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {morphoReadyAssets.map((asset) => (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm"
                >
                  <span className="font-medium text-terminal-text">{asset.title}</span>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/loans/${asset.id}`}
                      className="text-xs font-semibold text-terminal-primary hover:underline"
                    >
                      {t.adminAssets.configureLoan}
                    </Link>
                    <Link
                      href="/dashboard/loans"
                      className="text-xs font-semibold text-terminal-muted hover:text-terminal-primary"
                    >
                      {t.adminNav.loans}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-terminal-muted">{t.adminAssets.emptyMorphoReady}</p>
          )}
        </section>

        <div className="space-y-8">
          <AdminAssetsTable
            {...tableProps}
            title={t.adminAssets.sectionDebt}
            emptyMessage={t.adminAssets.emptyDebt}
            assets={debtAssets}
          />
          <AdminAssetsTable
            {...tableProps}
            title={t.adminAssets.sectionEquity}
            emptyMessage={t.adminAssets.emptyEquity}
            assets={equityAssets}
          />
        </div>
      </div>
    </AdminGate>
  );
}
