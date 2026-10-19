import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import Database from "better-sqlite3"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

// Le foyer de démonstration doit se tenir : revenus et crédits déclarés = flux réellement présents dans les opérations.
let dir: string
let data: {
  members: { name: string; monthlyIncomeCents: number; isChild: boolean }[]
  loans: { name: string; monthlyPaymentCents: number }[]
  rec: { name: string; amountCents: number; frequency: string; kind: string }[]
  props: { rentMonthlyCents: number }[]
  tx: { name: string; amountCents: number; date: string; categoryId: string | null; accountId: string | null }[]
  cats: Map<string, string>
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "licai-seed-"))
  const file = path.join(dir, "seed.db")
  // schéma initial (migrations SQL) ; les colonnes ajoutées depuis sont créées par lib/db-ensure.ts à l'ouverture
  const raw = new Database(file)
  const migrations = path.resolve("db/migrations")
  for (const f of fs.readdirSync(migrations).filter((x) => x.endsWith(".sql")).sort()) raw.exec(fs.readFileSync(path.join(migrations, f), "utf8").replaceAll("--> statement-breakpoint", ""))
  raw.close()
  vi.stubEnv("DATABASE_URL", `file:${file}`)
  vi.resetModules()
  const { db } = await import("@/lib/db")
  const schema = await import("@/db/schema")
  const { seedDemoData } = await import("@/db/seed")
  db.insert(schema.households).values({ id: "h1", name: "Test", createdAt: new Date() }).run()
  seedDemoData("h1")
  data = {
    members: db.select().from(schema.members).all(),
    loans: db.select().from(schema.loans).all(),
    rec: db.select().from(schema.recurring).all(),
    props: db.select().from(schema.properties).all().map((p) => ({ rentMonthlyCents: p.rentMonthlyCents })),
    tx: db.select().from(schema.transactions).all(),
    cats: new Map(db.select().from(schema.categories).all().map((c) => [c.id, c.label])),
  }
})
afterAll(() => { vi.unstubAllEnvs(); fs.rmSync(dir, { recursive: true, force: true }) })

const month = (offset: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 7) }

describe("foyer de démonstration", () => {
  it("chaque mois complet contient les salaires déclarés des adultes", () => {
    const m = month(-1)
    const declared = data.members.filter((x) => !x.isChild).reduce((s, x) => s + x.monthlyIncomeCents, 0)
    const salaries = data.tx.filter((t) => t.date.startsWith(m) && /^Salaire/.test(t.name)).reduce((s, t) => s + t.amountCents, 0)
    expect(salaries).toBe(declared)
  })
  it("chaque mois complet contient le loyer du studio et les mensualités de tous les crédits", () => {
    const m = month(-1)
    const rent = data.tx.filter((t) => t.date.startsWith(m) && /^Loyer studio/.test(t.name)).reduce((s, t) => s + t.amountCents, 0)
    expect(rent).toBe(data.props.reduce((s, p) => s + p.rentMonthlyCents, 0))
    const credits = data.tx.filter((t) => t.date.startsWith(m) && data.cats.get(t.categoryId ?? "") === "Crédits").reduce((s, t) => s - t.amountCents, 0)
    expect(credits).toBe(data.loans.reduce((s, l) => s + l.monthlyPaymentCents, 0))
  })
  it("chaque charge récurrente mensuelle déclarée est prélevée au même montant dans les opérations du mois", () => {
    const m = month(-1)
    const monthlyCharges = data.rec.filter((r) => r.frequency === "monthly" && r.kind !== "saving")
    expect(monthlyCharges.length).toBeGreaterThan(3)
    for (const r of monthlyCharges) {
      const seen = data.tx.filter((t) => t.date.startsWith(m) && t.name === r.name).map((t) => -t.amountCents)
      expect(seen, `${r.name} absent ou de montant différent`).toEqual([r.amountCents])
    }
  })
  it("l'historique couvre au moins deux mois complets (budgets suggérés, détection d'écarts)", () => {
    for (const offset of [-2, -1]) expect(data.tx.filter((t) => t.date.startsWith(month(offset))).length).toBeGreaterThan(8)
  })
  it("aucune opération n'est datée dans le futur et le logement n'est plus un « loyer » payé", () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(data.tx.filter((t) => t.date > today)).toEqual([])
    expect(data.tx.some((t) => t.name === "Loyer" && t.amountCents < 0)).toBe(false)
  })
})
