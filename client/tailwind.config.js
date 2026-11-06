/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#F7F7F4',
        card: '#FFFFFF',
        'text-primary': '#252923',
        'text-secondary': '#777D78',
        forest: {
          DEFAULT: '#28634D',
          hover: '#1F4E3C',
          light: '#EBF2EE',
          subtle: '#F0F5F2'
        },
        amber: {
          DEFAULT: '#D69A43',
          hover: '#BA8334',
          light: '#FBF5EC',
          subtle: '#FDFBF7'
        },
        border: {
          DEFAULT: '#E5E7E1',
          light: '#F0F2ED',
          dark: '#D0D4CA'
        },
        subtle: '#F0F2ED',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        card: '0 2px 6px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
