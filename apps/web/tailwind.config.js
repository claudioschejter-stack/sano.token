/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
      "./src/app/**/*.{js,ts,jsx,tsx}",
      "./src/components/**/*.{js,ts,jsx,tsx}",
      "./src/hooks/**/*.{js,ts,jsx,tsx}",
      "./src/i18n/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        keyframes: {
          shake: {
            '0%, 100%': { transform: 'translateX(0)' },
            '20%': { transform: 'translateX(-6px)' },
            '40%': { transform: 'translateX(6px)' },
            '60%': { transform: 'translateX(-4px)' },
            '80%': { transform: 'translateX(4px)' }
          }
        },
        animation: {
          shake: 'shake 0.4s ease-in-out'
        },
        colors: {
          terminal: {
            bg: 'var(--terminal-bg)',
            card: 'var(--terminal-card)',
            border: 'var(--terminal-border)',
            text: 'var(--terminal-text)',
            primary: 'var(--terminal-primary)',
            accent: 'var(--terminal-accent)',
            success: 'var(--terminal-success)',
            warning: 'var(--terminal-warning)',
            danger: 'var(--terminal-danger)',
            muted: 'var(--terminal-muted)'
          }
        }
      },
    },
    plugins: [],
  }