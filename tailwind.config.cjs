/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#2b8cee",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "surface-light": "#ffffff",
        "surface-dark": "#1A2633",
        "border-light": "#dbe0e6",
        "border-dark": "#2a3b4d",
        "card-light": "#ffffff",
        "card-dark": "#1e293b",
      },
      fontFamily: {
        "display": ["Cairo", "Inter", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.5rem",
        "full": "9999px"
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        'scale-in': 'scaleIn 0.5s ease-out forwards'
      },
      keyframes: {
        scaleIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      },
    },
  },
  plugins: [],
}
