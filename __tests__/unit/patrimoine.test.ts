import { describe, it, expect } from "vitest"
import { debtOf, immoSplit, monthlyOf, rentRows, yieldOf } from "@/lib/finance/patrimoine"
import { ctx } from "./fixtures"

describe("répartition de l'immobilier net", () => {
  const s = immoSplit(ctx)
  it("net par bien = valeur − crédits liés", () => {
    expect(debtOf(ctx.loans, ctx.properties[0])).toBe(142000)
    expect(monthlyOf(ctx.loans, ctx.properties[1])).toBe(430)
    expect(s.rows.map((r) => r.net)).toEqual([280000 - 142000, 130000 - 74000])
    expect(s.total).toBe(138000 + 56000)
    expect(s.rows.reduce((a, r) => a + r.w, 0)).toBeCloseTo(100, 5)
  })
  it("répartit au prorata des quotes-parts", () => {
    const sophie = s.persons.find((p) => p.id === "s")!
    expect(sophie.net).toBeCloseTo(138000 * 0.5 + 56000, 5)
    expect(s.persons.find((p) => p.id === "t")!.net).toBeCloseTo(69000, 5)
    expect(s.persons.find((p) => p.id === "l")).toBeUndefined()
  })
  it("sans bien : pas de division par zéro", () => {
    const e = immoSplit({ ...ctx, properties: [], loans: [] })
    expect(e.total).toBe(0)
    expect(e.rows).toEqual([])
  })
})

describe("rentabilité locative", () => {
  const studio = ctx.properties[1]
  it("calcule brut, net et net-net au réel", () => {
    const y = yieldOf(studio, ctx.loans, 30)
    expect(y.gross).toBe(7680)
    expect(y.vac).toBeCloseTo(384, 5)
    expect(y.charges).toBe(600 + 800 + 150 + 400 + 200)
    expect(y.base).toBe(118000)
    expect(y.net).toBeCloseTo(7680 - 384 - 2150, 5)
    expect(y.interest).toBeCloseTo((74000 * 1.9) / 100, 5)
    expect(y.taxable).toBeCloseTo(Math.max(0, y.net - y.interest), 5)
    expect(y.tax).toBeCloseTo(y.taxable * (0.3 + 0.172), 5)
    expect(y.brut).toBeCloseTo((7680 / 118000) * 100, 5)
    expect(y.nn).toBeLessThan(y.nette)
    expect(y.cashflow).toBeCloseTo((y.net - 430 * 12 - y.tax) / 12, 5)
    expect(y.onValue).toBeCloseTo(((y.net - y.tax) / 130000) * 100, 5)
  })
  it("sépare biens loués et biens occupés", () => {
    const r = rentRows(ctx, 30)
    expect(r.rented.map((x) => x.p.id)).toEqual(["p2"])
    expect(r.others.map((x) => x.p.id)).toEqual(["p1"])
    expect(r.others[0].monthlyOut).toBeCloseTo(900 / 12 + 890, 5)
  })
  it("bien sans prix ni valeur : rendements nuls", () => {
    const y = yieldOf({ ...studio, price: 0, value: 0, costs: { ...studio.costs, notaire: 0 } }, [], 30)
    expect(y.brut).toBe(0)
    expect(y.onValue).toBe(0)
  })
})
