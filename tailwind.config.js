/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Palette PANAME OS — voir MIGRATION_PANAME_OS.md
      colors: {
        paname: {
          100: '#DCE7FF',
          500: '#2557FF',
          700: '#0040DD',
          900: '#001F8C',
        },
        eiffel: '#F5C518',
        pavillon: '#FF2D2D',
        bitume: {
          DEFAULT: '#0A0A0F',
          2: '#14141C',
          3: '#1F1F2C',
        },
        calcaire: '#F5F4EE',
        signal: {
          DEFAULT: '#00D670',
          dark: '#009955',
        },
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        sans: ['Geist', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      // Glows colorés : 1px ring + halo diffus
      boxShadow: {
        paname: '0 0 0 1px rgba(0,64,221,0.3), 0 8px 32px -4px rgba(0,64,221,0.4)',
        or: '0 0 0 1px rgba(245,197,24,0.3), 0 8px 32px -4px rgba(245,197,24,0.4)',
        rouge: '0 0 0 1px rgba(255,45,45,0.3), 0 8px 32px -4px rgba(255,45,45,0.4)',
      },
    },
  },
  plugins: [],
}
