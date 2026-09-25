/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          deep: '#0D4752',
          primary: '#0F6B78',
          light: '#E6F4F6',
          hover: '#0a5864'
        },
        emergency: {
          red: '#D32F2F',
          dark: '#B71C1C',
          light: '#FDEDED',
          border: '#EF9A9A'
        },
        status: {
          green: '#2E7D32',
          greenLight: '#E8F5E9',
          amber: '#F9A825',
          amberLight: '#FFF8E1',
          blue: '#1976D2',
          blueLight: '#E3F2FD'
        },
        surface: {
          bg: '#F7FAFC',
          card: '#FFFFFF',
          border: '#D9E2E7',
          dark: '#17212B',
          muted: '#667085'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 2px 8px rgba(13, 71, 82, 0.08)',
        'elevated': '0 8px 24px rgba(13, 71, 82, 0.12)',
        'emergency': '0 0 20px rgba(211, 47, 47, 0.35)',
      },
      animation: {
        'subtle-pulse': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
