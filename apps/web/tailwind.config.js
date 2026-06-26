/** @type {import('tailwindcss').Config} */
module.exports = {
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
            bg: '#0A0E17',
            card: '#111827',
            border: '#1F2937',
            text: '#E2E8F0',
            primary: '#3B82F6',
            accent: '#F97316',
            success: '#22C55E',
            warning: '#FBBF24',
            danger: '#EF4444',
            muted: '#6B7280'
          }
        }
      },
    },
    plugins: [],
  }