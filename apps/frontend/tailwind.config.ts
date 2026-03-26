import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0a0a0f",
        panel: "rgba(255,255,255,0.07)",
        cyan: "#21d4fd",
        violet: "#a855f7",
        electric: "#3b82f6"
      },
      boxShadow: {
        glow: "0 0 30px rgba(33, 212, 253, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
