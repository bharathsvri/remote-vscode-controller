/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vscode: {
          darkBg: '#1e1e1e',
          darkSidebar: '#252526',
          darkPanel: '#181818',
          darkBorder: '#3c3c3c',
          blue: '#007acc',
          blueHover: '#0062a3',
        }
      }
    },
  },
  plugins: [],
};
