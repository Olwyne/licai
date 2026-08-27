import { describe, it, expect } from "vitest"
import { generateAlerts } from "@/lib/finance/alerts"

describe("generateAlerts", () => {
  it("generates danger alert when budget exceeded", () => {
    const alerts = generateAlerts({
      budgets: [{ categoryId: "food", label: "Alimentation", spentCents: 45000, limitCents: 40000 }],
      recurring: [],
      today: "2026-06-15",
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].tone).toBe("danger")
    expect(alerts[0].kind).toBe("budget")
  })

  it("generates warning when budget is 90-100%", () => {
    const alerts = generateAlerts({
      budgets: [{ categoryId: "food", label: "Alimentation", spentCents: 37000, limitCents: 40000 }],
      recurring: [],
      today: "2026-06-15",
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].tone).toBe("warning")
    expect(alerts[0].kind).toBe("budget")
  })

  it("generates warning when recurring due within 7 days", () => {
    const alerts = generateAlerts({
      budgets: [],
      recurring: [{ id: "r1", name: "Netflix", nextDate: "2026-06-18", amountCents: 1349 }],
      today: "2026-06-15",
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].tone).toBe("warning")
    expect(alerts[0].kind).toBe("echeance")
  })

  it("generates danger when recurring is overdue", () => {
    const alerts = generateAlerts({
      budgets: [],
      recurring: [{ id: "r1", name: "Netflix", nextDate: "2026-06-10", amountCents: 1349 }],
      today: "2026-06-15",
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].tone).toBe("danger")
    expect(alerts[0].kind).toBe("echeance")
  })

  it("no alerts when all is fine", () => {
    const alerts = generateAlerts({
      budgets: [{ categoryId: "food", label: "Alimentation", spentCents: 10000, limitCents: 40000 }],
      recurring: [{ id: "r1", name: "Netflix", nextDate: "2026-07-20", amountCents: 1349 }],
      today: "2026-06-15",
    })
    expect(alerts).toHaveLength(0)
  })

  it("skips budget with zero limit", () => {
    const alerts = generateAlerts({
      budgets: [{ categoryId: "misc", label: "Misc", spentCents: 1000, limitCents: 0 }],
      recurring: [],
      today: "2026-06-15",
    })
    expect(alerts).toHaveLength(0)
  })
})
