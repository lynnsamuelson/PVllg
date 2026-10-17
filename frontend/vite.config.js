import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin /api in dev, matching how Apache serves it in production.
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/admin": "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx}"],
    setupFiles: ["src/test/setup.js"],
    coverage: {
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/test/**", "src/**/*.test.{js,jsx}", "src/main.jsx"],
      reporter: ["text", "html"],
      // Floor at the current baseline so coverage can only go up. Pages are covered by Playwright.
      thresholds: { lines: 18 },
    },
  },
});
