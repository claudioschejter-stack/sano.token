'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { AdminGate } from './AdminGate';

type AdminSectionPlaceholderProps = {
  title: string;
  description: string;
};

export function AdminSectionPlaceholder({ title, description }: AdminSectionPlaceholderProps) {
  const t = useTranslation();

  return (
    <AdminGate>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-terminal-muted transition-colors hover:text-terminal-primary"
        >
          <ArrowLeft size={16} />
          {t.adminDashboard.backToPanel}
        </Link>

        <header className="rounded-xl border border-terminal-border bg-terminal-card p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">
            {t.adminDashboard.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-terminal-text">{title}</h1>
          <p className="mt-3 text-terminal-muted">{description}</p>
          <p className="mt-6 rounded-lg border border-dashed border-terminal-border bg-terminal-bg px-4 py-3 text-sm text-terminal-muted">
            {t.adminDashboard.comingSoon}
          </p>
        </header>
      </div>
    </AdminGate>
  );
}
