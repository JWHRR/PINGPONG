import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f5fa',
          100: '#e3e9f3',
          200: '#c4d0e4',
          300: '#97abcd',
          400: '#647fae',
          500: '#425f92',
          600: '#324a78',
          700: '#283c62',
          800: '#1a2a4a',
          900: '#0f1d36',
          950: '#081224',
        },
        pitch: {
          50: '#ecfdf6',
          100: '#d1fae9',
          200: '#a7f3d6',
          300: '#6ee7bd',
          400: '#34d39f',
          500: '#10b985',
          600: '#05966c',
          700: '#04785a',
          800: '#065f49',
          900: '#064e3d',
          950: '#022c23',
        },
        gold: {
          100: '#fdf3d1',
          200: '#fbe59e',
          300: '#f8d063',
          400: '#f5b935',
          500: '#e99b15',
          600: '#c9760f',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(8,18,36,.06), 0 4px 16px -4px rgba(8,18,36,.10)',
        lift: '0 2px 4px rgba(8,18,36,.08), 0 12px 32px -8px rgba(8,18,36,.22)',
      },
      keyframes: {
        livepulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.35', transform: 'scale(.8)' },
        },
        fadein: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        livepulse: 'livepulse 1.4s ease-in-out infinite',
        fadein: 'fadein .25s ease-out both',
        shimmer: 'shimmer 6s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
