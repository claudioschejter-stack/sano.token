'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';

type PasswordInputProps = {
  id: string;
  name?: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
};

export function PasswordInput({
  id,
  name = 'password',
  label,
  placeholder,
  autoComplete = 'current-password',
  value,
  onChange,
  required = true,
  minLength
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const access = useTranslation().access;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-mono uppercase tracking-widest text-slate-400"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-4 pr-12 font-light text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-blue-500/50 focus:bg-white/10 focus:ring-0"
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? access.hidePassword : access.showPassword}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-all duration-300 hover:bg-white/10 hover:text-white"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
