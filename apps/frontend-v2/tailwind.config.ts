import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // YouWorker Brand Colors
        brand: {
          red: '#E32D21',
          'red-light': '#F04438',
          'red-dark': '#C41E14',
          'red-hover': '#FF4136',
        },
        slate: {
          deep: '#454055',
          'deep-light': '#5A5566',
          'deep-dark': '#2D2938',
          'deep-darker': '#1F1B29',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        glass: {
          white: 'var(--color-glass-white)',
          slate: 'var(--color-glass-slate)',
          red: 'var(--color-glass-red)',
          DEFAULT: 'var(--color-glass)',
          dark: 'var(--color-glass-dark)',
          'red-border': 'var(--color-glass-red-border)',
        },
      },
      backdropBlur: {
        'glass-sm': '8px',
        'glass-md': '16px',
        'glass-lg': '24px',
        'glass-xl': '32px',
      },
      boxShadow: {
        'glass-sm': '0 4px 16px rgba(69, 64, 85, 0.4)',
        'glass-md': '0 8px 32px rgba(69, 64, 85, 0.5)',
        'glass-lg': '0 12px 48px rgba(69, 64, 85, 0.6)',
        'glass-red': '0 8px 24px rgba(227, 45, 33, 0.3)',
        'glass-red-lg': '0 12px 32px rgba(227, 45, 33, 0.4)',
        'glass-inner': 'inset 0 0 20px -5px rgba(255, 255, 255, 0.6)',
      },
      borderColor: {
        glass: 'rgba(255, 255, 255, 0.18)',
        'glass-dark': 'rgba(255, 255, 255, 0.12)',
        'glass-red': 'rgba(227, 45, 33, 0.3)',
      },
      backgroundColor: {
        'glass-white': 'rgba(255, 255, 255, 0.05)',
        'glass-slate': 'rgba(69, 64, 85, 0.3)',
        'glass-red': 'rgba(227, 45, 33, 0.1)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #E32D21 0%, #C41E14 100%)',
        'gradient-slate': 'linear-gradient(135deg, #454055 0%, #2D2938 100%)',
        'gradient-glass-slate': 'linear-gradient(135deg, rgba(69, 64, 85, 0.6) 0%, rgba(45, 41, 56, 0.8) 100%)',
      },
      animation: {
        'glass-shimmer': 'shimmer 2s linear infinite',
        'glass-float': 'float 3s ease-in-out infinite',
        'pulse-red': 'pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-red': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 0 0 rgba(227, 45, 33, 0.7)',
          },
          '50%': {
            opacity: '.8',
            boxShadow: '0 0 0 8px rgba(227, 45, 33, 0)',
          },
        },
      },
    },
  },
  plugins: [],
}

export default config
