import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths so the build works under any sub-path (e.g. GitHub Pages).
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1" },
  test: {
    environment: "jsdom",
    setupFiles: "src/test/setup.js",
  },
});
