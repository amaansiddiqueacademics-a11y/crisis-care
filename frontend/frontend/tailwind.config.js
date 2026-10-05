/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark base palette
        base: {
          bg:      '#080a0f',
          surface: '#0d1117',
          card:    '#111827',
          border:  'rgba(255,255,255,0.08)',
          muted:   '#6b7280',
        },
        // Emergency red system
        red: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
          deep: '#1a0005',
        },
        // Crisis accent
        crisis: {
          red:    '#ef4444',
          orange: '#f97316',
          amber:  '#f59e0b',
          pink:   '#ec4899',
        },
        // Status
        status: {
          online:   '#22c55e',
          warning:  '#f59e0b',
          critical: '#ef4444',
          offline:  '#6b7280',
        },
        // Teal theme (alternate)
        teal: {
          deep:    '#0D4752',
          primary: '#0F6B78',
          light:   '#E6F4F6',
          hover:   '#0a5864',
        },
        // Legacy surface tokens
        emergency: {
          red:    '#ef4444',
          dark:   '#b91c1c',
          light:  '#FDEDED',
          border: '#EF9A9A',
        },
        surface: {
          bg:     '#080a0f',
          card:   '#111827',
          border: 'rgba(255,255,255,0.08)',
          dark:   '#17212B',
          muted:  '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      boxShadow: {
        'subtle':      '0 2px 8px rgba(0,0,0,0.3)',
        'elevated':    '0 8px 32px rgba(0,0,0,0.5)',
        'emergency':   '0 0 32px rgba(239,68,68,0.3), 0 0 64px rgba(239,68,68,0.1)',
        'glow-red':    '0 0 20px rgba(239,68,68,0.25)',
        'glow-green':  '0 0 20px rgba(52,211,153,0.2)',
        'inner-glow':  'inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass':       '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'card':        '0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2)',
        'card-hover':  '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
      },
      backgroundImage: {
        'gradient-radial':  'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':   'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in':       'fadeIn 0.3s ease-out forwards',
        'slide-up':      'slideUp 0.4s ease-out forwards',
        'scale-in':      'scaleIn 0.3s ease-out forwards',
        'subtle-pulse':  'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe':       'breathe 2.5s ease-in-out infinite',
        'shimmer':       'shimmer 2s linear infinite',
        'spin-slow':     'spin 3s linear infinite',
        'bounce-slow':   'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        breathe: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.65', transform: 'scale(0.96)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',
        lg: '24px',
        xl: '40px',
      },
      transitionTimingFunction: {
        'spring':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':  'cubic-bezier(0.4, 0, 0.2, 1)',
        'in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
    },
  },
  plugins: [],
};
