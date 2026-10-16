import { describe, expect, it } from "vitest"
import Database from "better-sqlite3"
import { ensureSchema } from "@/lib/db-ensure"

// Vérifie que ensureSchema crée bien les tables dont purgeHousehold dépend (household_id sur chaque table de données).
describe("schéma et purge", () => {
  it("toutes les tables de données ont household_id", () => {
    const sqlite = new Database(":memory:")
    sqlite.exec("CREATE TABLE households (id TEXT PRIMARY KEY); CREATE TABLE users (id TEXT PRIMARY KEY, household_id TEXT)")
    ensureSchema(sqlite)
    const tables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name)
    for (const t of ["investment_flows", "portfolio_snapshots", "alert_states"]) {
      expect(tables).toContain(t)
      const cols = (sqlite.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name)
      expect(cols).toContain("household_id")
    }
  })
})
