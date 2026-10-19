import { describe, it, expect } from "vitest"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { ensureSchema } from "@/lib/db-ensure"

describe("migrations Drizzle", () => {
  it("s'appliquent sur une base vierge (une instruction par bloc), puis le rattrapage de schéma reste idempotent", () => {
    const sqlite = new Database(":memory:")
    migrate(drizzle(sqlite), { migrationsFolder: "db/migrations" })
    ensureSchema(sqlite)
    ensureSchema(sqlite)
    const cols = (sqlite.prepare("PRAGMA table_info(members)").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toContain("is_child")
    expect(cols).toContain("allowance_cents")
  })
})
