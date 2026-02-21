/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Cosmic design system
        vc: {
          purple: '#6C3CE1',
          'purple-light': '#8B5CF6',
          'purple-dark': '#4C1D95',
          coral: '#FF6B6B',
          teal: '#14B8A6',
          gold: '#F59E0B',
          slate: '#1E293B',
          gray: '#64748B',
          bg: '#0A0E1A',
          'bg-light': '#FAFAF9',
          surface: '#111827',
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
        'glow': '0 0 20px rgba(108, 60, 225, 0.3)',
        'glow-lg': '0 0 40px rgba(108, 60, 225, 0.4)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.3)',
        'glow-gold': '0 0 20px rgba(245, 158, 11, 0.3)',
        'glow-coral': '0 0 20px rgba(255, 107, 107, 0.3)',
        'cosmic': '0 4px 30px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1)',
        'cosmic-lg': '0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
      borderRadius: {
        'card': '16px',
        'btn': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'twinkle': 'twinkle 4s ease-in-out infinite',
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
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
      backgroundImage: {
        'cosmic-gradient': 'radial-gradient(ellipse at 20% 50%, rgba(108, 60, 225, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(20, 184, 166, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)',
      }
    }
  },
  plugins: []
}
