import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js}",
    "./shared/client/**/*.{vue,js}",
    "./modules/*/client/**/*.{vue,js}",
    "./platform/**/*.{vue,js,json}",
  ],
  safelist: [
    // Dynamic allocation category colors (used via template literals in AllocationBar, BucketBreakdown, AllocationTeamCard)
    { pattern: /bg-(amber|blue|green|gray|red|purple|indigo|cyan|teal|orange|pink|yellow|lime|emerald|sky|violet|fuchsia|rose)-400/ },
    { pattern: /text-(amber|blue|green|gray|red|purple|indigo|cyan|teal|orange|pink|yellow|lime|emerald|sky|violet|fuchsia|rose)-900/ },
    { pattern: /border-l-(amber|blue|green|gray|red|purple|indigo|cyan|teal|orange|pink|yellow|lime|emerald|sky|violet|fuchsia|rose)-400/ },
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [
    typography,
  ],
}
