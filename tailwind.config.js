/** @type {import('tailwindcss').Config} */

// Charte Aissociate (brand guide 2026) : la source fait foi dans docs/charte/tokens.css.
// Les palettes Tailwind sont redéfinies ici pour que toutes les classes existantes
// (neutral-*, slate-*, orange-*, brand-*…) prennent la charte sans réécrire les écrans.

// Gris chauds tirés des jetons : sable, filet, encre-douce, taupe, encre, noir.
const gris = {
  50: '#faf7f3',
  100: '#f2ece4', // sable / fond-alt
  200: '#e6dcd2', // filet
  300: '#d9cec3',
  400: '#a89c90',
  500: '#7a6f64',
  600: '#615850', // encre-douce
  700: '#483c32', // taupe
  800: '#2e261f',
  900: '#17120e', // encre
  950: '#0e0c0a', // noir
};

// Orange de marque : 500 = orange (#EA6A1E), 600 = orange-texte (#B24A0C, lisible en petit).
const orange = {
  50: '#fdf4ee',
  100: '#fbe6d6',
  200: '#f7cbaa',
  300: '#f4a26c',
  400: '#f0823f', // orange clair (fonds taupe et noir)
  500: '#ea6a1e', // orange
  600: '#b24a0c', // orange-texte
  700: '#923c0a',
  800: '#74300a',
  900: '#5a2508',
  950: '#331504',
};

// Les écrans utilisent brand-600 pour l'aplat orange : on garde ce décalage.
const brand = { ...orange, 500: '#f0823f', 600: '#ea6a1e', 700: '#b24a0c', 800: '#923c0a', 900: '#74300a', 950: '#331504' };

// Pas d'ombres dans la charte : la profondeur vient des aplats. Les anciennes ombres
// deviennent un filet d'un pixel, pour que menus et fenêtres restent détachés du fond.
const filet = '0 0 0 1px rgb(var(--line))';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neutral: gris,
        slate: gris,
        gray: gris,
        stone: gris,
        zinc: gris,
        orange,
        brand,
        // Jetons de la charte, utilisables tels quels (bg-encre, text-orange-texte…)
        encre: '#17120e',
        'encre-douce': '#615850',
        filet: '#e6dcd2',
        sable: '#f2ece4',
        taupe: '#483c32',
        noir: '#0e0c0a',
        'orange-texte': '#b24a0c',
        // Tokens sémantiques pilotés par variables CSS (clair/sombre)
        app: 'rgb(var(--app) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['Archivo', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: filet,
        sm: filet,
        DEFAULT: filet,
        md: filet,
        lg: filet,
        xl: filet,
        '2xl': filet,
        inner: 'none',
      },
    },
    // La marque est à angles droits ; seules les pastilles restent rondes (rounded-full).
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '9999px',
    },
  },
  plugins: [],
};
