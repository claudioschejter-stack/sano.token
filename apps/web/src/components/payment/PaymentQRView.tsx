'use client';

import { QRCodeSVG } from 'qrcode.react';
import { CreditCard, Download, ExternalLink, Wallet } from 'lucide-react';
import { useState } from 'react';

type PaymentQRViewProps = {
  fiatUrl: string;
  cryptoUri: string | null;
  treasuryAddress: string | null;
  chainId: number;
  hasFiat: boolean;
  hasCrypto: boolean;
};

function QRCard({
  title,
  subtitle,
  icon,
  value,
  accentClass,
  ctaLabel,
  ctaHref,
  badge
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  value: string;
  accentClass: string;
  ctaLabel: string;
  ctaHref: string;
  badge: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyValue = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col rounded-2xl border border-terminal-border bg-terminal-card overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 ${accentClass}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
          {icon}
        </div>
        <div>
          <p className="font-bold text-white">{title}</p>
          <p className="text-sm text-white/80">{subtitle}</p>
        </div>
        <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
          {badge}
        </span>
      </div>

      {/* QR Code */}
      <div className="flex flex-1 flex-col items-center gap-4 px-5 py-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <QRCodeSVG
            value={value}
            size={200}
            level="M"
            includeMargin={false}
          />
        </div>

        <p className="max-w-xs break-all text-center text-[10px] text-terminal-muted font-mono">
          {value.length > 80 ? `${value.slice(0, 60)}…` : value}
        </p>

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={copyValue}
            className="flex-1 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm font-medium text-terminal-text transition-colors hover:border-terminal-primary/40"
          >
            {copied ? '✓ Copiado' : 'Copiar enlace'}
          </button>
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {ctaLabel}
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

export function PaymentQRView({
  fiatUrl,
  cryptoUri,
  treasuryAddress,
  chainId,
  hasFiat,
  hasCrypto
}: PaymentQRViewProps) {
  const basescanUrl = treasuryAddress
    ? `https://basescan.org/address/${treasuryAddress}`
    : '#';

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-terminal-text">Cobrar pagos</h1>
        <p className="mt-1 text-sm text-terminal-muted">
          Compartí estos QR con tus inversores para recibir fondos — fiat o cripto.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Fiat QR */}
        {hasFiat ? (
          <QRCard
            title="Pago con tarjeta / banco"
            subtitle="El usuario paga en su moneda local → llega USDC"
            icon={<CreditCard size={20} />}
            value={fiatUrl}
            accentClass="bg-gradient-to-r from-amber-500 to-orange-500"
            ctaLabel="Abrir Transak"
            ctaHref={fiatUrl}
            badge="FIAT → USDC"
          />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-terminal-border p-8 text-center text-sm text-terminal-muted">
            Transak no configurado.<br />Agregar <code className="text-xs">TRANSAK_API_KEY</code> en Vercel.
          </div>
        )}

        {/* Crypto QR */}
        {hasCrypto && cryptoUri ? (
          <QRCard
            title="Pago con stablecoin"
            subtitle="Cualquier wallet EVM envía USDC directo en Base"
            icon={<Wallet size={20} />}
            value={cryptoUri}
            accentClass="bg-gradient-to-r from-blue-600 to-indigo-600"
            ctaLabel="Ver en Base"
            ctaHref={basescanUrl}
            badge="USDC · Base"
          />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-terminal-border p-8 text-center text-sm text-terminal-muted">
            Treasury no configurado.<br />Agregar <code className="text-xs">BASE_STABLECOIN_TREASURY_ADDRESS</code> en Vercel.
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="rounded-xl border border-terminal-border bg-terminal-card p-5 space-y-3">
        <p className="text-sm font-semibold text-terminal-text">¿Cómo funciona?</p>
        <div className="grid gap-3 text-xs text-terminal-muted sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-medium text-terminal-text">QR Fiat (naranja)</p>
            <p>El inversor escanea → abre Transak en su navegador → paga con tarjeta o transferencia bancaria → los fondos llegan como USDC a la cuenta de la plataforma automáticamente.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-terminal-text">QR Cripto (azul)</p>
            <p>El inversor escanea con MetaMask, Trust Wallet, Coinbase Wallet u otra wallet EVM → envía USDC en Base directamente a la dirección de la plataforma sin intermediarios.</p>
          </div>
        </div>
        {treasuryAddress && (
          <p className="text-xs text-terminal-muted">
            Dirección de recepción (Base):{' '}
            <a
              href={basescanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-terminal-primary hover:underline"
            >
              {treasuryAddress.slice(0, 10)}…{treasuryAddress.slice(-8)}
            </a>
            {' '}· Chain ID: {chainId}
          </p>
        )}
      </div>
    </section>
  );
}
