/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // New design system
        vc: {
          purple: '#6C3CE1',
          'purple-light': '#8B5CF6',
          'purple-dark': '#4C1D95',
          coral: '#FF6B6B',
          teal: '#14B8A6',
          gold: '#F59E0B',
          slate: '#1E293B',
          gray: '#64748B',
          bg: '#FAFAF9',
        },
        // Legacy aliases (for incremental migration)
        rally: {
          navy: '#6C3CE1',
          'navy-light': '#8B5CF6',
          red: '#6C3CE1',
          'red-light': '#8B5CF6',
          'red-pale': '#F3EEFF',
          yellow: '#F59E0B',
          'yellow-bright': '#FBBF24',
          green: '#14B8A6',
          'green-pale': '#F0FDFA',
          cream: '#FAFAF9',
          slate: '#1E293B',
          'slate-light': '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.05)',
        'lifted': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(108, 60, 225, 0.15)',
        'glow-lg': '0 0 40px rgba(108, 60, 225, 0.2)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      }
    }
  },
  plugins: []
}
