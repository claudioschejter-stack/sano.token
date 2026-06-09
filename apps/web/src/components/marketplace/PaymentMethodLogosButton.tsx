'use client';

type PaymentMethodLogosButtonProps = {
  label: string;
  expanded: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function VisaMark() {
  return (
    <span className="rounded bg-[#1A1F71] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">VISA</span>
  );
}

function MastercardMark() {
  return (
    <span className="relative flex h-4 w-6 items-center">
      <span className="absolute left-0 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
      <span className="absolute right-0 h-3.5 w-3.5 rounded-full bg-[#F79E1B]" />
    </span>
  );
}

function CoinbaseMark() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0052FF] text-[8px] font-bold text-white">
      C
    </span>
  );
}

function MetaMaskMark() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E2761B] text-[8px] font-bold text-white">
      M
    </span>
  );
}

function BinanceMark() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#F3BA2F] text-[8px] font-bold text-[#1E2329]">
      B
    </span>
  );
}

function GooglePayMark() {
  return (
    <span className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[8px] font-semibold text-slate-700">
      G Pay
    </span>
  );
}

export function PaymentMethodLogosButton({ label, expanded, onClick, disabled }: PaymentMethodLogosButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-terminal-primary bg-terminal-card px-3 py-[1mm] text-left transition hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-xs font-semibold text-terminal-text sm:text-sm">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <VisaMark />
        <MastercardMark />
        <CoinbaseMark />
        <MetaMaskMark />
        <BinanceMark />
        <GooglePayMark />
      </span>
    </button>
  );
}
