'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../providers/ThemeProvider';

type ThemeToggleButtonProps = {
  className?: string;
  variant?: 'sidebar' | 'compact';
};

export function ThemeToggleButton({ className = '', variant = 'sidebar' }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Modo claro' : 'Modo oscuro';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 ${className}`}
        aria-label={label}
        title={label}
      >
        <Icon size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-terminal-text transition hover:bg-terminal-border/40 ${className}`}
      aria-label={label}
    >
      <Icon size={18} className="shrink-0 text-terminal-muted" />
      <span>{label}</span>
    </button>
  );
}
