import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiUrl = process.env.API_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin /api in dev, matching how Apache serves it in production.
    proxy: {
      "/api": apiUrl,
      "/admin": apiUrl,
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
      // Floor just under the current coverage so it can only go up; raise it when coverage rises.
      thresholds: { lines: 91 },
    },
  },
});
