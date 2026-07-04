'use client';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accentColor?: string;
  label?: string;
};

export function ToggleSwitch({ checked, onChange, disabled = false, accentColor = '#009EE3', label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      style={{ backgroundColor: checked ? accentColor : '#CBD5E1' }}
    >
      <span
        className="inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform"
        style={{ transform: checked ? 'translateX(28px)' : 'translateX(4px)' }}
      />
    </button>
  );
}
