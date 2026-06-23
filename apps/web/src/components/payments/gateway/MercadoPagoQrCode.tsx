'use client';

type MercadoPagoQrCodeProps = {
  value: string;
  label: string;
};

export function MercadoPagoQrCode({ value, label }: MercadoPagoQrCodeProps) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(value)}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <img src={qrSrc} alt={label} width={240} height={240} className="rounded-lg border border-terminal-border bg-white p-2" />
      <p className="max-w-xs text-center text-xs text-terminal-muted">{label}</p>
    </div>
  );
}
