import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./frontend/**/*.{ts,tsx}', './frontend/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
