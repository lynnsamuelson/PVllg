import { defineConfig, devices } from "@playwright/test";

// Starts its own Django + Vite on separate ports with a throwaway SQLite file, so it never
// touches your dev database or a DB_HOST tunnel to production.
const API_PORT = 8001;
const WEB_PORT = 5174;
const python = process.env.PYTHON || ".venv/bin/python";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `rm -rf e2e.sqlite3 e2e-mail && ${python} manage.py migrate -v0 && ${python} manage.py runserver ${API_PORT} --noreload`,
      cwd: "../backend",
      url: `http://127.0.0.1:${API_PORT}/api/health/`,
      env: {
        DB_HOST: "",
        SQLITE_PATH: "e2e.sqlite3",
        EMAIL_HOST: "",
        EMAIL_FILE_PATH: "e2e-mail", // e2e/org-signup.spec.js reads the emailed code from here
        DJANGO_DEBUG: "true",
        DJANGO_CSRF_TRUSTED_ORIGINS: `http://127.0.0.1:${WEB_PORT}`,
      },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
