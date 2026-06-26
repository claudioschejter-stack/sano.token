'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, Loader2, Mail, RefreshCw, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { AdminGate } from './AdminGate';

type WaitlistEntry = {
  id: string;
  email: string;
  projectId: string;
  createdAt: string;
};

type ApiResponse = {
  total: number;
  entries: WaitlistEntry[];
  byProject: Record<string, { email: string; createdAt: string }[]>;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function exportCsv(entries: WaitlistEntry[]) {
  const rows = [
    ['Email', 'Propiedad', 'Fecha'],
    ...entries.map((e) => [e.email, e.projectId, formatDate(e.createdAt)])
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WaitlistContent() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/waitlist', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este prospecto de la lista de espera?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/waitlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setData((prev) =>
        prev
          ? {
              ...prev,
              total: prev.total - 1,
              entries: prev.entries.filter((e) => e.id !== id)
            }
          : prev
      );
    } finally {
      setDeletingId(null);
    }
  };

  const projects = data ? ['ALL', ...Object.keys(data.byProject).sort()] : ['ALL'];

  const filtered =
    data?.entries.filter((e) => selectedProject === 'ALL' || e.projectId === selectedProject) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-terminal-muted hover:text-terminal-text"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
          <span className="text-terminal-muted">/</span>
          <h1 className="text-base font-bold text-terminal-text">Lista de espera</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg border border-terminal-border px-3 py-1.5 text-xs text-terminal-muted hover:text-terminal-text"
          >
            <RefreshCw size={13} />
            Actualizar
          </button>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={() => exportCsv(filtered)}
              className="flex items-center gap-1.5 rounded-lg bg-terminal-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              <Download size={13} />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
              Total prospectos
            </p>
            <p className="mt-1 text-2xl font-bold text-terminal-text">{data.total}</p>
          </div>
          <div className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
              Propiedades
            </p>
            <p className="mt-1 text-2xl font-bold text-terminal-text">
              {Object.keys(data.byProject).length}
            </p>
          </div>
          <div className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-3 col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
              Mayor interés
            </p>
            <p className="mt-1 truncate text-sm font-bold text-terminal-primary">
              {Object.entries(data.byProject).sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? '—'}
            </p>
          </div>
        </div>
      )}

      {/* Filter by project */}
      {data && Object.keys(data.byProject).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedProject(p)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedProject === p
                  ? 'border-terminal-primary bg-terminal-primary text-white'
                  : 'border-terminal-border text-terminal-muted hover:text-terminal-text'
              }`}
            >
              {p === 'ALL' ? 'Todas' : p}
              {p !== 'ALL' && (
                <span className="ml-1.5 opacity-70">
                  ({data.byProject[p]?.length ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading / error */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-terminal-primary" />
          <span className="text-sm text-terminal-muted">Cargando prospectos…</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-card py-16 text-center">
          <Users className="h-8 w-8 text-terminal-muted/40" />
          <p className="text-sm text-terminal-muted">Todavía no hay prospectos anotados.</p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-terminal-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-terminal-border bg-terminal-bg">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
                  Email
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
                  Propiedad
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
                  Fecha
                </th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border bg-terminal-card">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-terminal-bg/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="shrink-0 text-terminal-muted" />
                      <span className="font-medium text-terminal-text">{entry.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-terminal-primary/30 bg-terminal-primary/10 px-2 py-0.5 text-[11px] font-semibold text-terminal-primary">
                      {entry.projectId}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-terminal-muted">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deletingId === entry.id}
                      onClick={() => void handleDelete(entry.id)}
                      className="rounded-lg p-1.5 text-terminal-muted hover:text-red-400 disabled:opacity-40"
                      aria-label="Eliminar"
                    >
                      {deletingId === entry.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-terminal-border bg-terminal-bg px-4 py-2 text-right text-[11px] text-terminal-muted">
            {filtered.length} prospecto{filtered.length !== 1 ? 's' : ''}
            {selectedProject !== 'ALL' && ` en ${selectedProject}`}
          </div>
        </div>
      )}
    </div>
  );
}

export function WaitlistView() {
  return (
    <AdminGate>
      <WaitlistContent />
    </AdminGate>
  );
}
