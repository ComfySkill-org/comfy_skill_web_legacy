/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        skill: {
          blue: "#7EC8E3",
          "blue-dark": "#5BB5D5",
          yellow: "#FFF4B8",
          "yellow-dark": "#F5E6A3",
          ink: "#1a2b3c",
          muted: "#5a6b7c",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
