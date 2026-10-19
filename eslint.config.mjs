import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Paramètres préfixés « _ » = volontairement inutilisés (signatures de callbacks).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "coverage/**", "test-results/**", "playwright-report/**", "next-env.d.ts", "public/**"]),
])
