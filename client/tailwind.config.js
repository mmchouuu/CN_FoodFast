/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./App.jsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#fff4f1",
        solid: "#dc583e",      
        solidOne: "#ac2c28",
        solidTwo: "#fd872f",
        tertiary: "#d95942",
        textColor: "#404040",
        gray50: "#7b7b7b",
      },
    },
  },
  plugins: [],
}
