'use client';

import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLoansPreference } from '../../hooks/useLoansPreference';

export function LoansPreferenceToggle() {
  const t = useTranslation();
  const lp = t.loansPreference;
  const { loansEnabled, loading, error, setLoansEnabled } = useLoansPreference();
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    if (loading || saving) return;
    setSaving(true);
    await setLoansEnabled(!loansEnabled);
    setSaving(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Landmark size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{lp.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{lp.subtitle}</p>

          <button
            type="button"
            role="switch"
            aria-checked={loansEnabled}
            disabled={loading || saving}
            onClick={() => void handleToggle()}
            className={`mt-4 inline-flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
              loansEnabled
                ? 'border-orange-300 bg-orange-50 text-orange-900'
                : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
            } disabled:opacity-60`}
          >
            <span className="text-sm font-semibold">
              {loansEnabled ? lp.activeLabel : lp.inactiveLabel}
            </span>
            <span
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                loansEnabled ? 'bg-orange-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  loansEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </button>

          {error ? <p className="mt-2 text-sm text-red-600">{lp.error}</p> : null}
        </div>
      </div>
    </section>
  );
}
