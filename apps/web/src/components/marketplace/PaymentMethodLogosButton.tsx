'use client';

type PaymentMethodLogosButtonProps = {
  label: string;
  expanded: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function VisaMark() {
  return (
    <span className="rounded bg-[#1A1F71] px-[0.4rem] py-[0.15rem] text-[11px] font-bold tracking-wide text-white">VISA</span>
  );
}

function MastercardMark() {
  return (
    <span className="relative flex h-[22px] w-[32px] items-center">
      <span className="absolute left-0 h-[20px] w-[20px] rounded-full bg-[#EB001B]" />
      <span className="absolute right-0 h-[20px] w-[20px] rounded-full bg-[#F79E1B]" />
    </span>
  );
}

function CoinbaseMark() {
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#0052FF] text-[11px] font-bold text-white">
      C
    </span>
  );
}

function MetaMaskMark() {
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E2761B] text-[11px] font-bold text-white">
      M
    </span>
  );
}

function BinanceMark() {
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#F3BA2F] text-[11px] font-bold text-[#1E2329]">
      B
    </span>
  );
}

function GooglePayMark() {
  return (
    <span className="rounded border border-slate-200 bg-white px-[0.3rem] py-[0.15rem] text-[10px] font-semibold text-slate-700">
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
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-terminal-primary bg-terminal-card px-3 py-[1.1mm] text-left transition hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-base font-semibold text-terminal-text sm:text-lg">{label}</span>
      <span className="flex shrink-0 items-center gap-[0.55rem]">
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
