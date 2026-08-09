/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // §11 : thème clair/sombre avec bascule manuelle → stratégie par classe.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // DS Cap80 : sauge (primaire/succès) + terracotta (accent chaud).
        accent: { DEFAULT: '#059669', fg: '#ffffff' },
        terracotta: '#f97316',
      },
      fontFamily: {
        // Corps : Inter ; titres/gros chiffres : Outfit (auto-hébergés, hors-ligne).
        sans: [
          'Inter Variable',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        heading: [
          'Outfit Variable',
          'Inter Variable',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        // DS : coins doux — cards 16→24, boutons 12→16.
        lg: '0.75rem', // 12
        xl: '1rem', // 16
        '2xl': '1.25rem', // 20
        '3xl': '1.5rem', // 24
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
}
