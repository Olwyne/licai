import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    include: ["__tests__/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/finance/**", "lib/money.ts"],
      thresholds: { branches: 80, functions: 80, lines: 80 },
    },
  },
})
