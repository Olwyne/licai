import { describe, it, expect } from "vitest"
import { buildCalendar, cdf, daysBetween, deriveAlerts, goalOutlook, nextOccurrence, type AlertInputs } from "@/lib/finance/alerts-engine"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { ctx } from "./fixtures"

const today = "2026-06-01"
const base = (over: Partial<AlertInputs> = {}): AlertInputs => ({
  today, ctx, tax: computeTax(taxInputs(ctx), situationFor(ctx)),
  budgetsOver: [{ id: "c1", label: "Loisirs", icon: "ti-device-tv", spent: 210, limit: 150, avg3: 140 }],
  recurring: [
    { id: "r1", name: "Netflix", amount: 13.49, monthly: 13.49, frequency: "monthly", kind: "subscription", active: true, nextDate: "2026-06-20" },
    { id: "r2", name: "Assurance habitation", amount: 189, monthly: 15.75, frequency: "annual", kind: "charge", active: true, nextDate: "2026-09-12" },
    { id: "r3", name: "Assurance auto", amount: 126, monthly: 42, frequency: "quarterly", kind: "charge", active: true, nextDate: "2026-06-08" },
    { id: "r4", name: "Salle de sport", amount: 30, monthly: 30, frequency: "monthly", kind: "subscription", active: false, nextDate: "2026-06-10" },
  ],
  goals: [{ id: "g1", name: "Japon", current: 1000, target: 20000, deadline: "2027-06-01", risk: "prudent", monthly: 100 }],
  forecast: { ym: "2026-09", balance: 500, buffer: 3000, extras: ["Impôt solde", "Assurance"] },
  ...over,
})

describe("dates", () => {
  it("prochaine occurrence d'une date annuelle", () => {
    expect(nextOccurrence("10-15", today)).toBe("2026-10-15")
    expect(nextOccurrence("03-01", today)).toBe("2027-03-01")
    expect(daysBetween("2026-06-01", "2026-06-11")).toBe(10)
  })
  it("loi normale cumulée", () => {
    expect(cdf(0)).toBeCloseTo(0.5, 5)
    expect(cdf(1.96)).toBeCloseTo(0.975, 2)
    expect(cdf(-1.96)).toBeCloseTo(0.025, 2)
  })
})

describe("perspectives d'un objectif", () => {
  const g = { id: "g", name: "x", current: 1000, target: 20000, deadline: "2027-06-01", risk: "prudent", monthly: 100 }
  it("projette, calcule l'effort et une probabilité", () => {
    const o = goalOutlook(g, today)!
    expect(o.months).toBe(12)
    expect(o.proj).toBeGreaterThan(2000)
    expect(o.need).toBeGreaterThan(1000)
    expect(o.prob).toBeGreaterThanOrEqual(0)
    expect(o.prob).toBeLessThan(0.1)
  })
  it("pas d'effort ou pas d'échéance → pas de projection", () => {
    expect(goalOutlook({ ...g, monthly: null }, today)).toBeNull()
    expect(goalOutlook({ ...g, deadline: null }, today)).toBeNull()
  })
  it("échéance passée : effort = écart restant", () => {
    const o = goalOutlook({ ...g, deadline: "2026-05-01" }, today)!
    expect(o.months).toBe(0)
    expect(o.need).toBe(19000)
  })
  it("projection nulle → probabilité nulle", () => {
    expect(goalOutlook({ ...g, current: 0, monthly: 0 }, today)!.prob).toBe(0)
  })
})

describe("alertes dérivées", () => {
  const A = deriveAlerts(base())
  const ids = A.map((a) => a.id)
  it("contient le calendrier fiscal, le PER, les budgets, les crédits, la trésorerie", () => {
    expect(ids).toContain("d-ir")
    expect(ids).toContain("d-per")
    expect(ids).toContain("bud-c1")
    expect(ids).toContain("cash-low")
    expect(ids).toContain("abos")
    expect(ids).toContain("cred-rate-l3")
    expect(ids).toContain("est-p1")
    expect(ids).toContain("goal-g1")
  })
  it("trie par gravité puis échéance", () => {
    const rank = { high: 0, mid: 1, good: 2, info: 3 }
    const r = A.map((a) => rank[a.tone])
    expect([...r].sort((a, b) => a - b)).toEqual(r)
  })
  it("fin de crédit proche et tone high si échéance < 30 jours", () => {
    const soon = deriveAlerts(base({ ctx: { ...ctx, loans: ctx.loans.map((l) => (l.id === "l3" ? { ...l, endDate: "2026-12" } : l)) } }))
    expect(soon.some((a) => a.id === "cred-end-l3" && a.tone === "good")).toBe(true)
    expect(deriveAlerts(base({ today: "2026-06-01" })).find((a) => a.id === "d-ir")!.due).toBe("2026-06-06")
    expect(deriveAlerts(base({ today: "2026-06-01" })).find((a) => a.id === "d-ir")!.tone).toBe("high")
  })
  it("épargne de précaution insuffisante ou liquidités dormantes", () => {
    const poor = deriveAlerts(base({ ctx: { ...ctx, monthlySpend: 9000 } }))
    expect(poor.find((a) => a.id === "emergency")!.tone).toBe("high")
    const rich = deriveAlerts(base({ ctx: { ...ctx, monthlySpend: 1000 } }))
    expect(rich.some((a) => a.id === "idle-cash")).toBe(true)
  })
  it("plafond de livret, PEA 5 ans, assurance vie 8 ans, IFI", () => {
    const c2 = {
      ...ctx,
      cash: [...ctx.cash, { id: "ldds", name: "LDDS", type: "savings" as const, currency: "EUR", native: 11500, balance: 11500, ownerIds: [] }],
      invAccounts: [
        { ...ctx.invAccounts[1], since: 2019 },
        { ...ctx.invAccounts[0], since: 2019 },
      ],
      properties: ctx.properties.map((p) => ({ ...p, value: p.value * 8 })),
    }
    const B = deriveAlerts(base({ ctx: c2 })).map((a) => a.id)
    expect(B).toContain("ceil-ldds")
    expect(B).toContain("pea5-pea")
    expect(B).toContain("av8-av")
    expect(B).toContain("ifi")
  })
  it("rien de superflu sans données", () => {
    const empty = deriveAlerts(base({ ctx: { ...ctx, properties: [], loans: [], invAccounts: [], cash: [], monthlySpend: 0 }, budgetsOver: [], recurring: [], goals: [], forecast: null }))
    expect(empty.every((a) => a.kind === "echeance" || a.id === "per-room")).toBe(true)
    expect(empty.some((a) => a.id === "d-tf")).toBe(false)
  })
})

describe("calendrier 12 mois", () => {
  it("regroupe échéances, primes périodiques, taxe foncière et fins de crédit", () => {
    const inp = base({ ctx: { ...ctx, loans: ctx.loans.map((l) => (l.id === "l3" ? { ...l, endDate: "2026-12" } : l)) } })
    const cal = buildCalendar(inp, deriveAlerts(inp))
    const byMonth = Object.fromEntries(cal.map((m) => [m.ym, m.items.map((i) => i.label).join(" | ")]))
    expect(cal.length).toBeLessThanOrEqual(12)
    expect(byMonth["2026-06"]).toContain("Déclaration de revenus")
    expect(byMonth["2026-09"]).toContain("Assurance habitation (annuel)")
    expect(byMonth["2026-06"]).toContain("Assurance auto (trimestriel)")
    expect(byMonth["2026-10"]).toContain("Taxe foncière")
    expect(byMonth["2026-12"]).toContain("Dernière échéance — Auto")
    expect(buildCalendar(base({ recurring: [], forecast: null }), []).some((m) => m.ym === "2026-10")).toBe(true)
  })
})
