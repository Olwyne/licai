import { describe, expect, it } from "vitest"
import { roundBudget, suggestBudgets, type SpendTx } from "@/lib/finance/budget-suggest"

const sp = (categoryId: string, date: string, euros: number): SpendTx => ({ categoryId, date, amountCents: -Math.round(euros * 100) })
const TODAY = "2026-10-19"

describe("plafonds suggérés", () => {
  it("arrondit à 5 €, 10 € ou 50 € selon le montant", () => {
    expect([roundBudget(42), roundBudget(317), roundBudget(1240)]).toEqual([45, 320, 1250])
  })
  it("médiane des mois complets + 5 %, le mois en cours est exclu", () => {
    const txs = [sp("food", "2026-07-10", 300), sp("food", "2026-08-10", 320), sp("food", "2026-09-10", 310), sp("food", "2026-10-05", 999)]
    const [s] = suggestBudgets(txs, TODAY)
    expect(s).toMatchObject({ categoryId: "food", months: 3, median: 310, avg: 310 })
    expect(s.suggested).toBe(330) // 310 × 1,05 = 325,5 → 330
  })
  it("un mois exceptionnel ne fait pas dériver la suggestion (médiane)", () => {
    const txs = [sp("loisirs", "2026-07-10", 100), sp("loisirs", "2026-08-10", 110), sp("loisirs", "2026-09-10", 900)]
    expect(suggestBudgets(txs, TODAY)[0].suggested).toBe(120) // médiane 110
  })
  it("ignore les catégories avec moins de 2 mois ou moins de 10 € par mois, les revenus et les dépenses sans catégorie", () => {
    const txs = [sp("a", "2026-09-10", 200), sp("b", "2026-08-10", 5), sp("b", "2026-09-10", 6), { categoryId: "c", date: "2026-09-10", amountCents: 50000 }, { categoryId: null, date: "2026-09-11", amountCents: -9000 }, { categoryId: null, date: "2026-08-11", amountCents: -9000 }]
    expect(suggestBudgets(txs, TODAY)).toEqual([])
  })
  it("ne regarde que les 6 derniers mois complets", () => {
    const txs = [sp("x", "2026-03-10", 500), sp("x", "2026-02-10", 500), sp("x", "2026-09-10", 100), sp("x", "2026-08-10", 100)]
    expect(suggestBudgets(txs, TODAY)[0]).toMatchObject({ months: 2, median: 100 }) // mars et février sont hors fenêtre (avril à septembre)
  })
})
