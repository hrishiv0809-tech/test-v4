/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--border) / <alpha-value>)',
        ring: 'rgb(var(--primary) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: { DEFAULT: 'rgb(var(--card) / <alpha-value>)', foreground: 'rgb(var(--foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'rgb(var(--muted) / <alpha-value>)', foreground: 'rgb(var(--muted-fg) / <alpha-value>)' },
        primary: { DEFAULT: 'rgb(var(--primary) / <alpha-value>)', hover: 'rgb(var(--primary-hover) / <alpha-value>)', foreground: 'rgb(255 255 255 / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', foreground: 'rgb(60 42 12 / <alpha-value>)' },
        success: { DEFAULT: 'rgb(22 163 74 / <alpha-value>)', soft: 'rgb(220 252 231 / <alpha-value>)' },
        danger: { DEFAULT: 'rgb(220 38 38 / <alpha-value>)', soft: 'rgb(254 226 226 / <alpha-value>)' },
        warn: { DEFAULT: 'rgb(217 119 6 / <alpha-value>)', soft: 'rgb(254 249 195 / <alpha-value>)' },
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      keyframes: {
        in: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { in: 'in .18s ease-out', pop: 'pop .16s ease-out' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
