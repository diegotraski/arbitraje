/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surebet: {
          green: "#0fae5b",
          dark: "#0b1220",
        },
      },
    },
  },
  plugins: [],
};
