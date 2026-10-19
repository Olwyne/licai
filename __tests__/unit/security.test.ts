import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import Database from "better-sqlite3"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

let dir: string
let mods: { foreignRef: typeof import("@/lib/server/ownership").foreignRef; owns: typeof import("@/lib/server/ownership").owns; resolveAi: typeof import("@/lib/server/ai-key").resolveAi }

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "licai-sec-"))
  const file = path.join(dir, "sec.db")
  const raw = new Database(file)
  const migrations = path.resolve("db/migrations")
  for (const f of fs.readdirSync(migrations).filter((x) => x.endsWith(".sql")).sort()) raw.exec(fs.readFileSync(path.join(migrations, f), "utf8").replaceAll("--> statement-breakpoint", ""))
  raw.close()
  vi.stubEnv("DATABASE_URL", `file:${file}`)
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32-chars-minimum-abc")
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-server-key-0123456789")
  vi.resetModules()
  const { db } = await import("@/lib/db")
  const s = await import("@/db/schema")
  const now = new Date()
  for (const [id, email] of [["h-a", "a@example.fr"], ["h-b", "b@example.fr"], ["h-demo", "demo-1234@licai.demo"]] as const) {
    db.insert(s.households).values({ id, name: id, createdAt: now }).run()
    db.insert(s.users).values({ id: `u-${id}`, householdId: id, email, passwordHash: "x", role: "admin", createdAt: now }).run()
  }
  db.insert(s.accounts).values({ id: "acc-a", householdId: "h-a", name: "A", type: "checking" }).run()
  db.insert(s.accounts).values({ id: "acc-b", householdId: "h-b", name: "B", type: "checking" }).run()
  db.insert(s.categories).values({ id: "cat-a", householdId: "h-a", label: "Cat", icon: "ti-tag", colorHex: "#000000", isSystem: false }).run()
  db.insert(s.categories).values({ id: "cat-b", householdId: "h-b", label: "Cat", icon: "ti-tag", colorHex: "#000000", isSystem: false }).run()
  mods = { ...(await import("@/lib/server/ownership")), ...(await import("@/lib/server/ai-key")) }
})
afterAll(() => { vi.unstubAllEnvs(); fs.rmSync(dir, { recursive: true, force: true }) })

describe("références vers les données d'un autre foyer", () => {
  it("accepte les identifiants du foyer et les valeurs vides", () => {
    expect(mods.foreignRef("h-a", { accountId: "acc-a", categoryId: "cat-a" })).toBeNull()
    expect(mods.foreignRef("h-a", { accountId: null, categoryId: undefined, memberId: "", goalId: undefined })).toBeNull()
  })
  it("refuse un compte ou une catégorie d'un autre foyer, un identifiant inconnu ou d'un autre type", () => {
    expect(mods.foreignRef("h-a", { accountId: "acc-b" })).toMatch(/compte/)
    expect(mods.foreignRef("h-a", { toAccountId: "acc-b" })).toMatch(/destination/)
    expect(mods.foreignRef("h-a", { categoryId: "cat-b" })).toMatch(/catégorie/)
    expect(mods.foreignRef("h-a", { accountId: "n'existe-pas" })).toMatch(/introuvable/)
    expect(mods.foreignRef("h-a", { categoryId: "acc-a" })).toMatch(/catégorie/) // un compte n'est pas une catégorie
    expect(mods.foreignRef("h-a", { accountId: 123 })).toMatch(/compte/)
  })
  it("n'est pas injectable par l'identifiant", () => {
    expect(mods.owns("h-a", "accountId", "x' OR '1'='1")).toBe(false)
  })
})

describe("clé IA du serveur", () => {
  it("est utilisée par un foyer ordinaire sans clé propre", () => {
    expect(mods.resolveAi("h-a")).toMatchObject({ source: "server", key: "sk-ant-server-key-0123456789" })
  })
  it("n'est jamais prêtée aux foyers de démonstration publics", () => {
    expect(mods.resolveAi("h-demo")).toMatchObject({ source: "none", key: null })
  })
})
