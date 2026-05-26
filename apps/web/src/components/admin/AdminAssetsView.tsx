'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Pencil, Plus, RefreshCw, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { createIntlFormatters } from '../../i18n/formatters';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { AdminAssetRecord } from '../../lib/admin/assetsService';
import { AdminGate } from './AdminGate';

type AssetFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const FILTER_OPTIONS: AssetFilter[] = ['ALL', 'ACTIVE', 'INACTIVE'];

type EditDraft = {
  availableTokens: string;
  pricePerToken: string;
};

type AutomationJobView = {
  id: string;
  projectId: string | null;
  step: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAfter: string | null;
  error: string | null;
  updatedAt: string | null;
};

type DryRunResult = {
  projectId: string;
  ok: boolean;
  checks: Array<{ key: string; label: string; ok: boolean; detail: string }>;
  summary?: {
    plannedJobs: string[];
    contracts: { token: string | null; vault: string | null };
    treasury: string | null;
    morpho: unknown;
    liquidity: string;
    readyToBorrow: boolean;
  };
};

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
  const [jobs, setJobs] = useState<AutomationJobView[]>([]);
  const [jobsTableAvailable, setJobsTableAvailable] = useState(true);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);

  const filterLabels = t.adminAssets.filters as Record<AssetFilter, string>;
  const statusLabels = t.adminAssets.status as Record<'ACTIVE' | 'INACTIVE', string>;

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

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/automation-jobs?limit=20');
      if (!response.ok) throw new Error('Failed to load jobs');
      const data = (await response.json()) as {
        tableAvailable: boolean;
        jobs: AutomationJobView[];
      };
      setJobs(data.jobs ?? []);
      setJobsTableAvailable(data.tableAvailable);
    } catch {
      setJobs([]);
      setJobsTableAvailable(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets(filter);
  }, [filter, loadAssets]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

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

  async function postAssetAction(projectId: string, action: 'preflight' | 'repair-automation') {
    setUpdatingId(projectId);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/assets/${projectId}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error('Action failed');
      if (action === 'preflight') {
        const data = (await response.json()) as { preflight: DryRunResult };
        setDryRun({ ...data.preflight, projectId });
      }
      await loadAssets(filter);
    } catch {
      setSaveError(action === 'preflight' ? 'No se pudo simular la emisión.' : 'No se pudo reparar la automatización.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function processPendingJobs() {
    setUpdatingId('automation-jobs');
    setSaveError(null);
    try {
      const response = await fetch('/api/admin/automation-jobs/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 })
      });
      if (!response.ok) throw new Error('Jobs failed');
      await loadAssets(filter);
      await loadJobs();
    } catch {
      setSaveError('No se pudieron procesar los jobs pendientes.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateJob(jobId: string, action: 'retry' | 'cancel') {
    setUpdatingId(jobId);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/automation-jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error('Job update failed');
      await loadJobs();
      await loadAssets(filter);
    } catch {
      setSaveError(action === 'retry' ? 'No se pudo reintentar el job.' : 'No se pudo cancelar el job.');
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
          <p className="mt-3 max-w-3xl text-terminal-muted">{t.adminDashboard.assetsDesc}</p>
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
            <button
              type="button"
              onClick={() => void processPendingJobs()}
              disabled={updatingId === 'automation-jobs'}
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-primary/40 px-3 py-2 text-sm font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/10 disabled:opacity-50"
            >
              <RefreshCw size={16} className={updatingId === 'automation-jobs' ? 'animate-spin' : ''} />
              Procesar jobs RWA
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">Centro RWA</p>
              <h2 className="mt-1 text-xl font-bold text-terminal-text">Emisión, vault y préstamo por activo</h2>
              <p className="mt-1 text-sm text-terminal-muted">
                Controla readiness legal, pricing, treasury, Morpho, liquidez y último error antes de pedir préstamos.
              </p>
            </div>
            <p className="text-sm text-terminal-muted">
              Listos para préstamo:{' '}
              <span className="font-mono text-terminal-success">
                {assets.filter((asset) => asset.readyToBorrow).length}/{assets.length}
              </span>
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">Runbook treasury/Safe</p>
          <h2 className="mt-1 text-lg font-bold text-terminal-text">Custodia después del ownership transfer</h2>
          <div className="mt-3 grid gap-3 text-sm text-terminal-muted md:grid-cols-3">
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <p className="font-semibold text-terminal-text">1. Antes de emitir</p>
              <p className="mt-1">En producción la treasury debe ser contrato multisig/Safe y distinta de la deployer.</p>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <p className="font-semibold text-terminal-text">2. Después del deploy</p>
              <p className="mt-1">Token y vault transfieren ownership a treasury. La deployer deja de administrar mint/KYC.</p>
            </div>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <p className="font-semibold text-terminal-text">3. Cambios futuros</p>
              <p className="mt-1">Toda acción owner-only debe ejecutarse desde Safe y quedar auditada en eventos.</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-terminal-muted">
            Emergencia: `ALLOW_EOA_TREASURY_IN_PRODUCTION=true` sólo debe usarse temporalmente y con aprobación operativa.
          </p>
        </section>

        <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">Jobs RWA</p>
              <h2 className="mt-1 text-lg font-bold text-terminal-text">Cola durable de automatización</h2>
              <p className="mt-1 text-sm text-terminal-muted">
                Estado operativo de preflight, emisión, vault, Morpho, verificación y synthetic tests.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadJobs()}
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-3 py-2 text-sm text-terminal-muted transition-colors hover:text-terminal-text"
            >
              <RefreshCw size={16} />
              Refrescar jobs
            </button>
          </div>

          {!jobsTableAvailable ? (
            <p className="mt-4 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-sm text-terminal-warning">
              La tabla AutomationJob no está disponible; la automatización sigue usando fallback JSON.
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-terminal-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Step</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Proyecto</th>
                  <th className="px-3 py-2 font-semibold">Reintentos</th>
                  <th className="px-3 py-2 font-semibold">Próxima corrida</th>
                  <th className="px-3 py-2 font-semibold">Último error</th>
                  <th className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {jobs.length ? (
                  jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-3 py-2 font-mono text-terminal-text">{job.step}</td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-terminal-border px-2 py-1 text-terminal-muted">
                          {job.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-terminal-muted">{job.projectId ?? 'global'}</td>
                      <td className="px-3 py-2 text-terminal-muted">
                        {job.attempts}/{job.maxAttempts}
                      </td>
                      <td className="px-3 py-2 text-terminal-muted">
                        {job.runAfter ? new Date(job.runAfter).toLocaleString(intlLocale) : '-'}
                      </td>
                      <td className="max-w-xs px-3 py-2 text-terminal-muted">{job.error ?? 'Sin errores'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={updatingId === job.id}
                            onClick={() => void updateJob(job.id, 'retry')}
                            className="rounded border border-terminal-border px-2 py-1 text-terminal-muted hover:text-terminal-primary disabled:opacity-50"
                          >
                            Reintentar
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === job.id || job.status === 'DONE'}
                            onClick={() => void updateJob(job.id, 'cancel')}
                            className="rounded border border-red-500/30 px-2 py-1 text-red-400 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-terminal-muted">
                      No hay jobs recientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {saveError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{saveError}</p>
        ) : null}

        {dryRun ? (
          <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terminal-primary">Dry-run emisión</p>
                <h2 className="mt-1 text-lg font-bold text-terminal-text">
                  {dryRun.ok ? 'Simulación lista para ejecutar' : 'Simulación bloqueada'}
                </h2>
                <p className="mt-1 text-sm text-terminal-muted">Proyecto: {dryRun.projectId}</p>
              </div>
              <button
                type="button"
                onClick={() => setDryRun(null)}
                className="rounded border border-terminal-border px-2 py-1 text-xs text-terminal-muted hover:text-terminal-text"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
                <p className="text-xs font-semibold uppercase text-terminal-muted">Jobs que correrán</p>
                <p className="mt-2 font-mono text-sm text-terminal-text">
                  {dryRun.summary?.plannedJobs?.join(' -> ') || 'ninguno'}
                </p>
              </div>
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
                <p className="text-xs font-semibold uppercase text-terminal-muted">Contratos esperados</p>
                <p className="mt-2 text-xs text-terminal-muted">Token: {dryRun.summary?.contracts.token ?? 'se desplegará'}</p>
                <p className="mt-1 text-xs text-terminal-muted">Vault: {dryRun.summary?.contracts.vault ?? 'se desplegará'}</p>
                <p className="mt-1 text-xs text-terminal-muted">Treasury: {dryRun.summary?.treasury ?? 'no configurada'}</p>
              </div>
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
                <p className="text-xs font-semibold uppercase text-terminal-muted">Morpho / Liquidez / Borrow</p>
                <p className="mt-2 text-xs text-terminal-muted">Liquidez: {dryRun.summary?.liquidity ?? 'NO_CHECKED'}</p>
                <p className="mt-1 text-xs text-terminal-muted">
                  Ready-to-borrow: {dryRun.summary?.readyToBorrow ? 'sí' : 'no'}
                </p>
              </div>
              <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
                <p className="text-xs font-semibold uppercase text-terminal-muted">Checks</p>
                <div className="mt-2 space-y-1">
                  {dryRun.checks.map((entry) => (
                    <p key={entry.key} className={entry.ok ? 'text-xs text-terminal-success' : 'text-xs text-terminal-warning'}>
                      {entry.label}: {entry.ok ? 'OK' : entry.detail}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                <tr>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colAsset}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colLocation}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colPrice}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colSupply}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colYield}</th>
                  <th className="px-6 py-3 font-semibold">Ready borrow</th>
                  <th className="px-6 py-3 font-semibold">Vault / Morpho</th>
                  <th className="px-6 py-3 font-semibold">Legal / Pricing</th>
                  <th className="px-6 py-3 font-semibold">Último error</th>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colStatus}</th>
                  <th className="px-6 py-3 font-semibold">{t.adminAssets.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminAssets.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-10 text-center text-red-400">
                      {t.adminAssets.error}
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-10 text-center text-terminal-muted">
                      {t.adminAssets.empty}
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const isUpdating = updatingId === asset.id;
                    const isEditing = editingId === asset.id;
                    const statusKey = asset.isActive ? 'ACTIVE' : 'INACTIVE';
                    const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
                    const legalOk =
                      Boolean(asset.contracts.trust) &&
                      asset.centrifugeChecklist.legalAuditDone &&
                      asset.centrifugeChecklist.kycPolicyActive;
                    const pricingOk = asset.pricePerToken > 0 && (asset.navOracleUrl || morpho?.oracleAddress);
                    const lastError =
                      asset.deploymentEvents.find((event) => event.status === 'FAILED')?.message ??
                      morpho?.lastError ??
                      asset.vaultFundingError;

                    return (
                      <Fragment key={asset.id}>
                        <tr className="transition-colors hover:bg-terminal-bg/60">
                          <td className="px-6 py-4">
                            <p className="font-medium text-terminal-text">{asset.title}</p>
                            <p className="mt-1 font-mono text-xs text-terminal-muted">{asset.id}</p>
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
                            <p className="mt-1 text-xs">{asset.soldPercent}% {t.adminAssets.sold}</p>
                          </td>
                          <td className="px-6 py-4 font-mono text-terminal-accent">
                            {formatPercent(asset.targetYield)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${
                                asset.readyToBorrow
                                  ? 'border-terminal-success/30 text-terminal-success'
                                  : 'border-terminal-warning/30 text-terminal-warning'
                              }`}
                            >
                              {asset.readyToBorrow ? 'READY' : asset.automationReadiness.status}
                            </span>
                            <p className="mt-1 text-xs text-terminal-muted">{asset.automationReadiness.score}%</p>
                          </td>
                          <td className="min-w-52 px-6 py-4 text-xs text-terminal-muted">
                            <p>Vault: {asset.vaultAddress ? `${asset.vaultAddress.slice(0, 8)}...` : 'pendiente'}</p>
                            <p>Morpho: {morpho?.status ?? 'no seleccionado'}</p>
                            <p>Liquidez: {asset.morphoLiquidityStatus}</p>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <p className={legalOk ? 'text-terminal-success' : 'text-terminal-warning'}>
                              Legal: {legalOk ? 'OK' : 'bloqueante'}
                            </p>
                            <p className={pricingOk ? 'text-terminal-success' : 'text-terminal-warning'}>
                              Pricing: {pricingOk ? 'OK' : 'pendiente'}
                            </p>
                          </td>
                          <td className="max-w-xs px-6 py-4 text-xs text-terminal-muted">
                            {lastError ?? 'Sin errores'}
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
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void patchAsset(asset.id, { isActive: !asset.isActive })}
                                className="rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary disabled:opacity-50"
                              >
                                {asset.isActive ? t.adminAssets.unpublish : t.adminAssets.publish}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => (isEditing ? cancelEdit() : startEdit(asset))}
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
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void postAssetAction(asset.id, 'preflight')}
                                className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-primary disabled:opacity-50"
                              >
                                Simular
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void postAssetAction(asset.id, 'repair-automation')}
                                className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-primary disabled:opacity-50"
                              >
                                Reparar
                              </button>
                              <Link
                                href={`/marketplace/${asset.id}/checkout`}
                                className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-2.5 py-1.5 text-xs font-semibold text-terminal-muted transition-colors hover:text-terminal-primary"
                              >
                                <ExternalLink size={14} />
                                {t.adminAssets.view}
                              </Link>
                            </div>
                          </td>
                        </tr>
                        {isEditing ? (
                          <tr className="bg-terminal-bg/40">
                            <td colSpan={11} className="px-6 py-4">
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
                                    onClick={() => void saveEdit(asset.id)}
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
        </section>
      </div>
    </AdminGate>
  );
}
