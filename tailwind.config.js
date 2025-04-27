/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: '#4889C8',
        green: '#009449',
        pink: '#BE69A9',
        light: '#FFFFF0',
        dark: '#36454F',
      },
    },
  },
  plugins: [],
}
