import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1220',
          900: '#111a2e',
          800: '#1b2740',
          700: '#2a3752',
          400: '#8a97b1',
        },
        accent: {
          50: '#eef6ff',
          100: '#d9ebff',
          300: '#8cc4ff',
          500: '#1f6feb',
          600: '#1a5fd0',
          700: '#154ca8',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
