/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F3F0FF',
          100: '#E0D9FF',
          200: '#C4B5FD',
          300: '#A78BFA',
          400: '#7C6FFF',
          500: '#6356F5',
          600: '#4F43D4',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        secondary: {
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
        },
        accent: {
          400: '#F472B6',
          500: '#EC4899',
          600: '#DB2777',
        },
        income: {
          DEFAULT: '#22C55E',
          light: '#DCFCE7',
        },
        expense: {
          DEFAULT: '#F43F5E',
          light: '#FFE4E6',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
