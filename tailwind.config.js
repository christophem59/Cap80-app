/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // §11 : thème clair/sombre suivant le système AVEC bascule manuelle → stratégie
  // par classe. Un thème « system » applique/retire la classe `dark` sur <html>.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // §11 : une seule couleur d'accent pour les données (bleu). Le vert/orange/
        // rouge sont réservés aux ÉTATS, jamais comme couleur de série.
        accent: {
          DEFAULT: '#2563eb',
          fg: '#ffffff',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      spacing: {
        // §11 : zones sûres Android (barre de navigation gestuelle).
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
}
