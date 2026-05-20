'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { setDemoKycStatus } from '../../hooks/useKycStatus';

function KycPageContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/marketplace';

  const completeDemoKyc = () => {
    setDemoKycStatus('APPROVED');
    window.location.href = returnTo;
  };

  return (
    <section className="mx-auto max-w-xl">
      <article className="rounded-xl border border-terminal-border bg-terminal-card p-8">
        <div className="mb-4 inline-flex rounded-lg border border-terminal-border bg-terminal-bg p-3 text-terminal-warning">
          <ShieldCheck size={24} />
        </div>

        <h1 className="text-2xl font-bold text-terminal-text">Verificación KYC</h1>
        <p className="mt-3 text-terminal-muted">
          Integración con proveedor Sumsub. Tras la aprobación automática, el webhook actualizará tu estado a
          verificado.
        </p>

        <button
          type="button"
          onClick={completeDemoKyc}
          className="mt-6 w-full rounded-lg bg-terminal-primary px-4 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Simular aprobación KYC (demo)
        </button>

        <Link href={returnTo} className="mt-4 block text-center text-sm text-terminal-muted hover:text-terminal-text">
          Cancelar
        </Link>
      </article>
    </section>
  );
}

export default function KycPage() {
  return (
    <Suspense fallback={<p className="text-terminal-muted">Cargando KYC…</p>}>
      <KycPageContent />
    </Suspense>
  );
}
