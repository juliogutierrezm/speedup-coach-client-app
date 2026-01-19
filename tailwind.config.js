/** @type {import('tailwindcss').Config} */
const { addDynamicIconSelectors } = require('@iconify/tailwind')
const dynamicColor = (variable) => ({ opacityValue }) => {
  if (opacityValue === undefined) {
    return `rgb(var(${variable}))`;
  }
  return `rgb(var(${variable}) / ${opacityValue})`;
};

module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        skin: {
          base: dynamicColor('--color-bg'),
          surface: dynamicColor('--color-surface'),
          'surface-soft': dynamicColor('--color-surface-soft'),
          text: dynamicColor('--color-text'),
          muted: dynamicColor('--color-muted'),
          accent: dynamicColor('--color-accent'),
          'border-soft': dynamicColor('--color-border-soft'),
          glass: dynamicColor('--color-glass'),
          frost: dynamicColor('--color-frost')
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'Inter', 'Poppins', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        'liquid-soft': '0 20px 60px rgba(8, 7, 29, 0.25)'
      }
    }
  },
   plugins: [addDynamicIconSelectors()]
};
