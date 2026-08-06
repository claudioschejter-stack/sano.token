'use client';

import { CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { LocalWalletRail } from '../../lib/payments/localWalletRail';

type Instructions = {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  reference?: string;
  currency?: string;
  estimatedSettlement?: string;
  iban?: string;
  clabe?: string;
  brCode?: string;
  sortCode?: string;
};

type BridgeResponse = {
  instructions?: Instructions;
  isSimulated?: boolean;
  sourceCurrency?: string;
  kyc?: { kycLink: string | null; tosLink: string | null; kycStatus?: string };
  error?: string;
};

/** A QR any wallet in the country can scan, rendered from the rail's own code. */
function qrImageUrl(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(
    payload
  )}`;
}

function CopyRow(props: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-terminal-border py-2 last:border-0">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-terminal-muted">
        {props.label}
      </span>
      <span className="flex items-start gap-2">
        <span
          className={`break-all text-right text-xs text-terminal-text ${props.mono ? 'font-mono' : ''}`}
        >
          {props.value}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(props.value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-terminal-muted"
          aria-label={`Copiar ${props.label}`}
        >
          {copied ? <CheckCircle2 size={13} className="text-terminal-success" /> : <Copy size={13} />}
        </button>
      </span>
    </div>
  );
}

/**
 * What the investor actually does, once the country picked the rail.
 *
 * Pix hands back a code their wallet scans; SPEI and the rest hand back account
 * details they paste into their banking app. Same rail resolution, two different
 * physical actions — showing a CLABE as a QR nobody can scan, or a Pix code as a
 * bank account nobody can transfer to, would make the button useless in half the
 * countries it covers.
 */
export function LocalRailInstructions(props: {
  /** Omit to let the country decide, which is what the browser cannot do alone. */
  rail?: LocalWalletRail;
  amountUsd: number;
  referenceId: string;
  country: string;
}) {
  const [data, setData] = useState<BridgeResponse | null>(null);
  const [rail, setRail] = useState<LocalWalletRail | null>(props.rail ?? null);
  const [loading, setLoading] = useState(true);

  /**
   * Resolving the rail reads provider configuration, which only exists on the
   * server: doing it in the browser would report every rail as switched off.
   */
  useEffect(() => {
    if (props.rail) {
      setRail(props.rail);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/payments/local-wallet-rail?country=${encodeURIComponent(props.country)}`,
          { credentials: 'same-origin', cache: 'no-store' }
        );
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { ok: boolean; rail: LocalWalletRail | null };
        if (payload.ok && payload.rail) setRail(payload.rail);
      } catch {
        // Leaves `rail` null, which renders nothing rather than something wrong.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.rail, props.country]);

  useEffect(() => {
    if (!rail) return;
    if (rail.provider !== 'bridge') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const query = new URLSearchParams({
          referenceId: props.referenceId,
          amountUsd: String(props.amountUsd),
          country: props.country
        });
        const res = await fetch(`/api/payments/bridge-virtual-account?${query.toString()}`, {
          credentials: 'same-origin',
          cache: 'no-store'
        });
        if (cancelled) return;
        setData((await res.json()) as BridgeResponse);
      } catch {
        if (!cancelled) setData({ error: 'BRIDGE_UNAVAILABLE' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [rail, props.referenceId, props.amountUsd, props.country]);

  if (!rail) {
    return null;
  }

  if (rail.provider === 'macro_click') {
    return (
      <p className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3 text-xs text-terminal-muted">
        Te vamos a llevar a la página de pago del banco para completar la transferencia.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3 text-xs text-terminal-muted">
        <Loader2 size={14} className="animate-spin" />
        Preparando tus datos de pago…
      </div>
    );
  }

  /**
   * Bridge verifies its own customers, so this is where an investor we already
   * verified can still be stopped. Naming it beats a generic failure.
   */
  if (data?.kyc?.kycLink) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-900/10 px-4 py-3">
        <p className="text-xs leading-relaxed text-terminal-text">
          Falta una verificación de nuestro proveedor de pagos locales. Se hace una sola vez y
          después pagás en un toque.
        </p>
        <a
          href={data.kyc.kycLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Completar verificación
          <ExternalLink size={14} />
        </a>
      </div>
    );
  }

  const instructions = data?.instructions;
  if (!instructions) {
    return (
      <p className="rounded-xl border border-amber-500/40 bg-amber-900/10 px-4 py-3 text-xs text-amber-500">
        No pudimos preparar los datos de pago en este momento. Probá de nuevo en un minuto.
      </p>
    );
  }

  // Pix: the BR code is the payment. Everything else is a bank transfer.
  if (rail.presentation === 'qr' && instructions.brCode) {
    return (
      <div className="space-y-3 rounded-xl border border-terminal-border bg-terminal-bg px-4 py-4">
        <p className="text-xs text-terminal-muted">
          Escaneá con tu billetera. {rail.settlementHint.toLowerCase()}.
        </p>
        <div className="flex justify-center">
          <Image
            src={qrImageUrl(instructions.brCode)}
            alt="Código Pix"
            width={220}
            height={220}
            unoptimized
            className="rounded-lg bg-white p-2"
          />
        </div>
        <CopyRow label="Pix copia y pega" value={instructions.brCode} mono />
      </div>
    );
  }

  const rows: Array<{ label: string; value: string; mono?: boolean }> = [];
  if (instructions.clabe) rows.push({ label: 'CLABE', value: instructions.clabe, mono: true });
  if (instructions.iban) rows.push({ label: 'IBAN', value: instructions.iban, mono: true });
  if (!instructions.clabe && !instructions.iban && instructions.accountNumber) {
    rows.push({ label: 'Cuenta', value: instructions.accountNumber, mono: true });
  }
  if (instructions.routingNumber && instructions.routingNumber !== '—') {
    rows.push({ label: 'Routing', value: instructions.routingNumber, mono: true });
  }
  if (instructions.sortCode) rows.push({ label: 'Sort code', value: instructions.sortCode, mono: true });
  if (instructions.accountName) rows.push({ label: 'Titular', value: instructions.accountName });
  if (instructions.bankName) rows.push({ label: 'Banco', value: instructions.bankName });

  return (
    <div className="space-y-2 rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3">
      <p className="text-xs text-terminal-muted">
        Transferí desde tu billetera o tu banco a estos datos. {rail.settlementHint}.
      </p>
      <div>
        {rows.map((row) => (
          <CopyRow key={row.label} {...row} />
        ))}
      </div>
      {data?.isSimulated ? (
        <p className="text-[11px] font-medium text-amber-500">
          Datos de prueba: el proveedor de pagos todavía no está configurado.
        </p>
      ) : null}
    </div>
  );
}
