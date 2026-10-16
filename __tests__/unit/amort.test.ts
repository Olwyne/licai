import { describe, it, expect } from "vitest"
import { addMonths, byYear, earlyRepayment, grow, monthLabel, pmt, schedule } from "@/lib/finance/amort"
import { CURRENCIES, DEFAULT_FX, currencySym, exposure, fmtCurrency, fxRate, mergeFx } from "@/lib/finance/fx"

describe("amortissement", () => {
  it("rembourse tout le capital", () => {
    const rows = schedule(100000, 2, 1000)
    expect(rows[rows.length - 1].left).toBeLessThan(1)
    expect(rows.reduce((s, r) => s + r.cap, 0)).toBeCloseTo(100000, 0)
    expect(rows[0].int).toBeCloseTo((100000 * 0.02) / 12, 5)
  })
  it("mensualité insuffisante → échéancier vide", () => {
    expect(schedule(100000, 5, 100)).toEqual([])
  })
  it("taux nul et mensualité d'un prêt", () => {
    expect(pmt(12000, 0, 12)).toBe(1000)
    expect(pmt(0, 0, 0)).toBe(0)
    expect(pmt(100000, 2, 240)).toBeCloseTo(505.88, 1)
  })
  it("capitalisation d'un placement", () => {
    expect(grow(1000, 0, 1, 0)).toBeCloseTo(1000, 5)
    expect(grow(1000, 0, 10, 5)).toBeCloseTo(1000 * 1.05 ** 10, 3)
  })
  it("dates et agrégat annuel", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02")
    expect(addMonths("2026-01", -1)).toBe("2025-12")
    expect(monthLabel("2026-06")).toBe("juin 2026")
    const rows = schedule(50000, 2, 1000)
    const y = byYear(rows, "2026-06")
    expect(y.reduce((s, r) => s + r.n, 0)).toBe(rows.length)
    expect(y[0].year).toBe("2026")
  })
  it("remboursement anticipé : réduire la durée ou la mensualité", () => {
    const loan = { left: 100000, rate: 2, monthly: 1000 }
    const d = earlyRepayment(loan, 20000, "duree", 3)
    expect(d.newMonths).toBeLessThan(d.months)
    expect(d.saved).toBeGreaterThan(0)
    expect(d.ira).toBeCloseTo(Math.min(600, (100000 * 0.02) / 2), 5)
    expect(d.gain).toBeCloseTo(d.saved - d.ira, 5)
    const m = earlyRepayment(loan, 20000, "mensualite", 3)
    expect(m.newMonthly).toBeLessThan(1000)
    expect(m.newMonths).toBe(m.months)
    const over = earlyRepayment(loan, 9e9, "duree", 3)
    expect(over.amount).toBe(100000)
    expect(earlyRepayment(loan, 0, "duree", 3).implicitPct).toBe(0)
  })
})

describe("devises", () => {
  it("taux par défaut et fusion sûre des taux stockés", () => {
    expect(fxRate("EUR")).toBe(1)
    expect(fxRate("XXX")).toBe(1)
    expect(fxRate("USD")).toBe(DEFAULT_FX.USD)
    const m = mergeFx({ USD: 0.9, EUR: 5, ZZZ: 3, GBP: -1, CHF: "x" })
    expect(m.USD).toBe(0.9)
    expect(m.EUR).toBe(1)
    expect(m.GBP).toBe(DEFAULT_FX.GBP)
    expect("ZZZ" in m).toBe(false)
    expect(mergeFx(null)).toEqual(DEFAULT_FX)
    expect(Object.keys(CURRENCIES)).toContain("XOF")
  })
  it("formate dans la devise d'origine", () => {
    expect(fmtCurrency(1234, "EUR")).toBe("1 234 €")
    expect(fmtCurrency(12.5, "USD")).toBe("12,50 $")
    expect(currencySym("CHF")).toBe("CHF")
    expect(currencySym("???")).toBe("???")
  })
  it("exposition par devise", () => {
    const e = exposure(
      [{ cur: "EUR", native: 1000, balance: 1000 }, { cur: "USD", native: 500, balance: 441 }],
      [{ cur: "USD", value: 559, qty: 5, price: 126.8 }],
    )
    expect(e.total).toBe(2000)
    expect(e.cash).toBe(1441)
    expect(e.rows[0].cur).toBe("EUR")
    expect(e.rows.find((r) => r.cur === "USD")!.w).toBeCloseTo(50, 5)
    expect(exposure([], []).total).toBe(0)
  })
})

import { borrowable, capacity, DEFAULT_CAPACITY } from "@/lib/finance/credit"
import { ctx as fixtureCtx } from "./fixtures"

describe("capacité d'emprunt", () => {
  it("capital empruntable pour une mensualité", () => {
    expect(borrowable(1000, 0, 120)).toBe(120000)
    expect(borrowable(0, 3, 120)).toBe(0)
    expect(borrowable(1000, 3.4, 240)).toBeCloseTo(173963.17, 1)
  })
  it("deux méthodes de calcul et budget d'acquisition", () => {
    const K = capacity(fixtureCtx, DEFAULT_CAPACITY)
    expect(K.sal).toBe(4450)
    expect(K.rents).toBe(640)
    expect(K.charges).toBe(890 + 430 + 320)
    expect(K.rentalCharge).toBe(430)
    expect(K.revClassic).toBeCloseTo(4450 + 640 * 0.7, 5)
    expect(K.revDiff).toBeCloseTo(4450 + 210, 5)
    expect(K.maxDiff).toBeCloseTo(K.revDiff * 0.35 - (1640 - 430), 5)
    expect(K.best).toBe(Math.max(K.maxDiff, K.maxClassic))
    expect(K.budget).toBeCloseTo((K.borrow + DEFAULT_CAPACITY.apport) * 0.925, 5)
  })
  it("aucune capacité si les 35 % sont atteints", () => {
    const K = capacity({ ...fixtureCtx, loans: fixtureCtx.loans.map((l) => ({ ...l, monthly: l.monthly * 5 })) }, DEFAULT_CAPACITY)
    expect(K.best).toBeLessThan(0)
    expect(K.borrow).toBe(0)
    expect(K.budget).toBe(0)
  })
  it("sans revenus, les ratios restent finis", () => {
    const K = capacity({ ...fixtureCtx, members: [], properties: [] }, DEFAULT_CAPACITY)
    expect(K.ratioClassic).toBe(0)
    expect(K.ratioDiff).toBe(0)
  })
})
