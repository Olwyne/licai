import { defineConfig, devices } from "@playwright/test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

// Si la révision de Chromium attendue par Playwright n'est pas installée, on réutilise un navigateur déjà présent
// (ou celui indiqué par E2E_CHROMIUM_PATH) plutôt que d'exiger un téléchargement.
function installedChromium(): string | undefined {
  if (process.env.E2E_CHROMIUM_PATH) return process.env.E2E_CHROMIUM_PATH
  const root = path.join(os.homedir(), "Library/Caches/ms-playwright")
  try {
    const dirs = fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse()
    for (const d of dirs) {
      const base = path.join(root, d)
      for (const sub of fs.readdirSync(base)) {
        const bin = path.join(base, sub, "chrome-headless-shell")
        if (fs.existsSync(bin)) return bin
      }
    }
  } catch { /* pas de cache Playwright */ }
  return undefined
}
const executablePath = installedChromium()

const PORT = 3100

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  globalSetup: "./__tests__/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } }],
  webServer: {
    command: `node scripts/e2e-prepare.mjs && npm run build && npm start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: "file:./data/test.db",
      NEXTAUTH_SECRET: "test-secret-32-chars-minimum-abc",
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      AUTH_TRUST_HOST: "true",
      AI_SKIP_KEY_CHECK: "1", // pas d'appel réseau pour vérifier les clés IA des tests
    },
  },
})
