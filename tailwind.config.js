/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        rally: {
          navy: '#0A1628',
          'navy-light': '#162240',
          red: '#E63946',
          'red-light': '#FF6B6B',
          'red-pale': '#FFF0F0',
          yellow: '#FFD166',
          'yellow-bright': '#FFE44D',
          green: '#06D6A0',
          'green-pale': '#ECFDF5',
          cream: '#FFFCF2',
          slate: '#334155',
          'slate-light': '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      }
    }
  },
  plugins: []
}
