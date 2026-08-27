import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "file:./data/test.db",
      NEXTAUTH_SECRET: "test-secret-32-chars-minimum-abc",
      NEXTAUTH_URL: "http://localhost:3000",
    },
  },
})
