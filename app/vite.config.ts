import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  clearScreen: false,
  plugins: [preact()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
