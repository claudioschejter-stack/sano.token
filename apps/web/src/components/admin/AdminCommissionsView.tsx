'use client';

import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { AdvisorCategory } from '@sanova/database';
import { AdminGate } from './AdminGate';

type CategoryRuleForm = {
  category: AdvisorCategory;
  sortOrder: number;
  minBookAumUsd: number;
  minActiveInvestors: number;
  minQualifyingDays: number;
  advisorMultiplierBps: number;
};

type PolicyForm = {
  name: string;
  purchaseFeeBps: number;
  rentFeeBps: number;
  platformOpexShareBps: number;
  adminOpsShareBps: number;
  advisorPoolShareBps: number;
  advisorDirectShareBps: number;
  managerShareBps: number;
  platformResidualBps: number;
  categoryRules: CategoryRuleForm[];
};

const CATEGORY_ORDER: AdvisorCategory[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

const inputClassName =
  'w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text outline-none focus:border-terminal-primary/50';

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(2);
}

function percentToBps(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function AdminCommissionsView() {
  const t = useTranslation();
  const c = t.adminCommissions;

  const [form, setForm] = useState<PolicyForm | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/commissions/policy', { cache: 'no-store' });
      const data = (await response.json()) as {
        policy?: PolicyForm & { version: number };
        error?: string;
      };

      if (!response.ok || !data.policy) {
        throw new Error(data.error ?? 'LOAD_FAILED');
      }

      setForm({
        name: data.policy.name,
        purchaseFeeBps: data.policy.purchaseFeeBps,
        rentFeeBps: data.policy.rentFeeBps,
        platformOpexShareBps: data.policy.platformOpexShareBps,
        adminOpsShareBps: data.policy.adminOpsShareBps,
        advisorPoolShareBps: data.policy.advisorPoolShareBps,
        advisorDirectShareBps: data.policy.advisorDirectShareBps,
        managerShareBps: data.policy.managerShareBps,
        platformResidualBps: data.policy.platformResidualBps,
        categoryRules: data.policy.categoryRules.sort((a, b) => a.sortOrder - b.sortOrder)
      });
      setVersion(data.policy.version);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const updateCategoryRule = (category: AdvisorCategory, patch: Partial<CategoryRuleForm>) => {
    setForm((current) =>
      current
        ? {
            ...current,
            categoryRules: current.categoryRules.map((rule) =>
              rule.category === category ? { ...rule, ...patch } : rule
            )
          }
        : current
    );
  };

  const handleSave = async () => {
    if (!form) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/commissions/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name || 'Política principal' })
      });
      const data = (await response.json()) as { ok?: boolean; policy?: { version: number }; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? c.saveError);
      }

      setVersion(data.policy?.version ?? version + 1);
      setMessage(c.saved);
      await loadPolicy();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : c.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/commissions/policy?action=evaluate-categories', {
        method: 'POST'
      });
      const data = (await response.json()) as { ok?: boolean; evaluated?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? c.evaluateError);
      }

      setMessage(c.evaluated.replace('{count}', String(data.evaluated ?? 0)));
    } catch (evaluateError) {
      setError(evaluateError instanceof Error ? evaluateError.message : c.evaluateError);
    } finally {
      setEvaluating(false);
    }
  };

  const categoryLabels = c.categories as Record<AdvisorCategory, string>;

  return (
    <AdminGate>
      <section className="mx-auto max-w-5xl space-y-6 bg-terminal-bg text-terminal-text md:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-primary"
            >
              <ArrowLeft size={16} />
              {c.backToPanel}
            </Link>
            <p className="text-xs uppercase tracking-wider text-terminal-primary">{c.eyebrow}</p>
            <h1 className="text-2xl font-bold">{c.title}</h1>
            <p className="mt-1 text-sm text-terminal-muted">{c.subtitle}</p>
            {version > 0 ? (
              <p className="mt-2 text-xs text-terminal-muted">
                {c.versionLabel.replace('{version}', String(version))}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadPolicy()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-4 py-2 text-sm hover:bg-terminal-card disabled:opacity-50"
            >
              <RefreshCw size={16} />
              {c.reload}
            </button>
            <button
              type="button"
              onClick={() => void handleEvaluate()}
              disabled={evaluating || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-4 py-2 text-sm hover:bg-terminal-card disabled:opacity-50"
            >
              {evaluating ? c.evaluating : c.evaluateCategories}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || !form}
              className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? c.saving : c.save}
            </button>
          </div>
        </div>

        {loading || !form ? (
          <p className="text-sm text-terminal-muted">{c.loading}</p>
        ) : (
          <>
            <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{c.feesTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{c.feesSubtitle}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-terminal-muted">{c.purchaseFeeLabel}</span>
                  <input
                    className={inputClassName}
                    value={bpsToPercent(form.purchaseFeeBps)}
                    onChange={(event) =>
                      setForm({ ...form, purchaseFeeBps: percentToBps(event.target.value) })
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-terminal-muted">{c.rentFeeLabel}</span>
                  <input
                    className={inputClassName}
                    value={bpsToPercent(form.rentFeeBps)}
                    onChange={(event) =>
                      setForm({ ...form, rentFeeBps: percentToBps(event.target.value) })
                    }
                  />
                </label>
              </div>
            </article>

            <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{c.poolTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{c.poolSubtitle}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ['platformOpexShareBps', c.platformOpexLabel],
                    ['adminOpsShareBps', c.adminOpsLabel],
                    ['advisorPoolShareBps', c.advisorPoolLabel]
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-sm">
                    <span className="text-terminal-muted">{label}</span>
                    <input
                      className={inputClassName}
                      value={bpsToPercent(form[key])}
                      onChange={(event) =>
                        setForm({ ...form, [key]: percentToBps(event.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{c.advisorSplitTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{c.advisorSplitSubtitle}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ['advisorDirectShareBps', c.advisorDirectLabel],
                    ['managerShareBps', c.managerLabel],
                    ['platformResidualBps', c.platformResidualLabel]
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-sm">
                    <span className="text-terminal-muted">{label}</span>
                    <input
                      className={inputClassName}
                      value={bpsToPercent(form[key])}
                      onChange={(event) =>
                        setForm({ ...form, [key]: percentToBps(event.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-terminal-border bg-terminal-card p-0">
              <div className="border-b border-terminal-border px-4 py-4 sm:px-6">
                <h2 className="text-lg font-semibold">{c.categoriesTitle}</h2>
                <p className="mt-1 text-sm text-terminal-muted">{c.categoriesSubtitle}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
                    <tr>
                      <th className="px-4 py-3 text-left lg:px-6">{c.colCategory}</th>
                      <th className="px-4 py-3 text-right lg:px-6">{c.colMinAum}</th>
                      <th className="px-4 py-3 text-right lg:px-6">{c.colMinInvestors}</th>
                      <th className="px-4 py-3 text-right lg:px-6">{c.colMinDays}</th>
                      <th className="px-4 py-3 text-right lg:px-6">{c.colMultiplier}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORY_ORDER.map((category) => {
                      const rule = form.categoryRules.find((row) => row.category === category);
                      if (!rule) return null;

                      return (
                        <tr key={category} className="border-t border-terminal-border/60">
                          <td className="px-4 py-3 font-medium lg:px-6">{categoryLabels[category]}</td>
                          <td className="px-4 py-3 lg:px-6">
                            <input
                              className={inputClassName}
                              value={rule.minBookAumUsd}
                              onChange={(event) =>
                                updateCategoryRule(category, {
                                  minBookAumUsd: Number(event.target.value) || 0
                                })
                              }
                            />
                          </td>
                          <td className="px-4 py-3 lg:px-6">
                            <input
                              className={inputClassName}
                              value={rule.minActiveInvestors}
                              onChange={(event) =>
                                updateCategoryRule(category, {
                                  minActiveInvestors: Number(event.target.value) || 0
                                })
                              }
                            />
                          </td>
                          <td className="px-4 py-3 lg:px-6">
                            <input
                              className={inputClassName}
                              value={rule.minQualifyingDays}
                              onChange={(event) =>
                                updateCategoryRule(category, {
                                  minQualifyingDays: Number(event.target.value) || 0
                                })
                              }
                            />
                          </td>
                          <td className="px-4 py-3 lg:px-6">
                            <input
                              className={inputClassName}
                              value={bpsToPercent(rule.advisorMultiplierBps)}
                              onChange={(event) =>
                                updateCategoryRule(category, {
                                  advisorMultiplierBps: percentToBps(event.target.value)
                                })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}

        {message ? <p className="text-sm text-terminal-success">{message}</p> : null}
        {error ? <p className="text-sm text-terminal-warning">{error}</p> : null}
      </section>
    </AdminGate>
  );
}
