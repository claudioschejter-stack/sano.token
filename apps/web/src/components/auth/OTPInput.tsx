'use client';

import { useEffect, useRef, KeyboardEvent, ClipboardEvent } from 'react';

type OTPInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
};

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false
}: OTPInputProps) {
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) {
      refs.current[0]?.focus();
    }
  }, [autoFocus]);

  function focusIndex(index: number) {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[index] = digit;
    const newValue = next.join('').slice(0, length);
    onChange(newValue);

    if (digit && index < length - 1) {
      focusIndex(index + 1);
    }

    if (newValue.replace(/\s/g, '').length === length) {
      onComplete?.(newValue);
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        const next = digits.slice();
        next[index] = '';
        onChange(next.join(''));
      } else {
        focusIndex(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      focusIndex(index - 1);
    } else if (e.key === 'ArrowRight') {
      focusIndex(index + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, '').slice(0, length));
    const focusTarget = Math.min(pasted.length, length - 1);
    focusIndex(focusTarget);
    if (pasted.length >= length) {
      onComplete?.(pasted.slice(0, length));
    }
  }

  const baseCell =
    'h-14 w-12 rounded-xl border-2 text-center text-2xl font-bold tabular-nums transition-all outline-none focus:ring-2 disabled:opacity-50';
  const normalCell = 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-100';
  const errorCell = 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-100 animate-shake';

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { refs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoComplete="one-time-code"
          aria-label={`Dígito ${index + 1} de ${length}`}
          className={`${baseCell} ${error ? errorCell : normalCell}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
