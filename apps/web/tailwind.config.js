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
            muted: '#6B7280'
          }
        }
      },
    },
    plugins: [],
  }