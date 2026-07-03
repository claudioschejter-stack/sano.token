'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { formFieldClassName } from '../../lib/ui/formFieldClassName';

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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
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
          className={`${formFieldClassName} py-3 pl-4 pr-12`}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? access.hidePassword : access.showPassword}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
