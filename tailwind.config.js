/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050706",
        panel: "#0d1410",
        panelSoft: "#121b16",
        line: "#213228",
        accent: "#7ad47d",
        accentStrong: "#2fa45c",
        warning: "#d7b347",
        danger: "#ff6b6b",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(122,212,125,0.12), 0 18px 48px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        aura:
          "radial-gradient(circle at top, rgba(47,164,92,0.28), transparent 32%), radial-gradient(circle at 80% 15%, rgba(122,212,125,0.12), transparent 18%)",
      },
    },
  },
  plugins: [],
};
