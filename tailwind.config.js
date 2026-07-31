/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Roxo/violeta da marca.
        brand: {
          50: '#f2efff',
          100: '#e6e0ff',
          200: '#cfc3ff',
          300: '#b09eff',
          400: '#9174ff',
          500: '#7c5cff',
          600: '#6a41f5',
          700: '#5a31d6',
          800: '#4a2aad',
          900: '#3d258a',
        },
        // Superfícies escuras do app.
        ink: {
          950: '#08080b',
          900: '#0e0e13',
          850: '#14141b',
          800: '#1b1b24',
          700: '#26262f',
          600: '#3a3a45',
          500: '#5a5a68',
          400: '#8b8b99',
          300: '#b6b6c2',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        bar: {
          '0%,100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'slide-up': 'slide-up .28s cubic-bezier(.32,.72,0,1)',
        'fade-in': 'fade-in .2s ease-out',
        bar: 'bar 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
