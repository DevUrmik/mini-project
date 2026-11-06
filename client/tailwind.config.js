/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        safety: {
          bg: '#0a0f1d',
          card: '#111827',
          surface: '#1f2937',
          border: '#374151',
          primary: '#38bdf8',
          accent: '#6366f1',
          warning: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981'
        }
      }
    },
  },
  plugins: [],
}

