/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'studio': '0 0 80px -20px rgba(34,211,238,0.3)',
      },
      colors: {
        brand: {
          300: 'hsl(var(--color-brand-300, 192 90% 70%))',
          400: 'hsl(var(--color-brand-400))',
          500: 'hsl(var(--color-brand-500))',
          600: 'hsl(var(--color-brand-600))',
          800: 'hsl(var(--color-brand-800, 192 90% 20%))',
          950: 'hsl(var(--color-brand-950, 192 90% 10%))',
        },
        surface: {
          primary: 'hsl(var(--color-surface-primary))',
          secondary: 'hsl(var(--color-surface-secondary))',
          accent: 'hsl(var(--color-surface-accent))',
        },
        telemetry: {
          success: 'hsl(var(--color-telemetry-success))',
          warning: 'hsl(var(--color-telemetry-warning))',
          danger: 'hsl(var(--color-telemetry-danger))',
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'ripple': 'ripple 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'dash': 'dash 10s linear forwards',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(34,211,238,0.4), 0 0 24px rgba(34,211,238,0.1)' },
          '50%': { boxShadow: '0 0 16px rgba(34,211,238,0.6), 0 0 48px rgba(34,211,238,0.2)' },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'ripple': {
          '0%': { transform: 'scale(0.8)', opacity: '1', boxShadow: '0 0 0 0 rgba(34, 211, 238, 0.4)' },
          '100%': { transform: 'scale(2.5)', opacity: '0', boxShadow: '0 0 0 40px rgba(34, 211, 238, 0)' }
        },
        'dash': {
          '0%': { strokeDasharray: '0, 314' },
          '100%': { strokeDasharray: '314, 0' }
        }
      },
    },
  },
  plugins: [],
}