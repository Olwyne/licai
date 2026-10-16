import { describe, it, expect } from "vitest"
import {
  ASSETS, INV_KINDS, PROFILES, allocationRows, byAcct, computePortfolio, computePositions, feeRows, fxRate, group, investAdvice, investTaxRows, usedCeiling,
} from "@/lib/finance/invest"
import { eur, eurS, initials, num2, pc, pcS } from "@/lib/finance/format"
import { ctx } from "./fixtures"

describe("positions", () => {
  it("valorise en euros avec conversion de devise", () => {
    const pos = computePositions(ctx.holdings)
    const iw = pos.find((p) => p.tk === "IWDA")!
    expect(iw.value).toBeCloseTo(100 * 114 * fxRate("USD"), 5)
    expect(iw.pv).toBeCloseTo(100 * 114 * 0.882 - 100 * 90 * 0.882, 5)
    expect(pos.reduce((s, p) => s + p.w, 0)).toBeCloseTo(100, 5)
    expect(pos[0].value).toBeGreaterThanOrEqual(pos[pos.length - 1].value)
  })
  it("utilise la plus-value connue pour les fonds euro", () => {
    expect(computePositions(ctx.holdings).find((p) => p.tk === "EURO")!.pv).toBe(1400)
  })
  it("les cours saisis remplacent les cours enregistrés", () => {
    const pos = computePositions(ctx.holdings, { CAC: { price: 100 } })
    const cac = pos.find((p) => p.tk === "CAC")!
    expect(cac.price).toBe(100)
    expect(cac.quoteSrc).toBe("manuel")
  })
  it("calcule la variation du jour", () => {
    const mc = computePositions(ctx.holdings).find((p) => p.tk === "MC")!
    expect(mc.day).toBe(0)
    const cac = computePositions(ctx.holdings).find((p) => p.tk === "CAC")!
    expect(cac.day).toBeCloseTo((87 - 86) / 86, 8)
  })
})

describe("portefeuille", () => {
  const S = computePortfolio(ctx, "equilibre")
  it("agrège valorisation, versements, frais et TRI", () => {
    expect(S.total).toBeGreaterThan(0)
    expect(S.paid).toBe(60000)
    expect(S.monthly).toBe(900)
    expect(S.match).toBeCloseTo(60, 5)
    expect(S.fees).toBeGreaterThan(0)
    expect(Number.isFinite(S.tri)).toBe(true)
    expect(S.cls.reduce((s, c) => s + c.w, 0)).toBeCloseTo(100, 5)
  })
  it("portefeuille vide : aucun NaN", () => {
    const E = computePortfolio({ ...ctx, holdings: [], invAccounts: [] }, "prudent")
    expect(E.total).toBe(0)
    expect(E.tri).toBe(0)
    expect(E.ter).toBe(0)
    expect(investAdvice(E, ctx)).toEqual([])
  })
  it("allocation vs cible", () => {
    const rows = allocationRows(S)
    expect(rows).toHaveLength(6)
    const a = rows.find((r) => r.k === "actions")!
    expect(a.gap).toBeCloseTo(a.cur - PROFILES.equilibre.target.actions, 8)
  })
  it("regroupe par clé et par fonction", () => {
    expect(group(S.pos, "zone").reduce((s, g) => s + g.v, 0)).toBeCloseTo(S.total, 5)
    expect(group(S.pos, (p) => INV_KINDS[ctx.invAccounts.find((a) => a.id === p.acct)!.kind].label).length).toBeGreaterThan(1)
    expect(byAcct(S.pos, "pea")).toBeGreaterThan(0)
    expect(usedCeiling(ctx.invAccounts, "pea")).toBe(15000)
    expect(usedCeiling(ctx.invAccounts, "peapme")).toBe(0)
  })
  it("frais par ligne triés", () => {
    const f = feeRows(S, ctx.invAccounts)
    expect(f.rows.length).toBeLessThanOrEqual(7)
    expect(f.rows[0].v).toBeGreaterThanOrEqual(f.rows[f.rows.length - 1].v)
    expect(f.top).toBeGreaterThan(0)
  })
  it("simulation fiscale", () => {
    const rows = investTaxRows(S, ctx, 30, 5000)
    expect(rows).toHaveLength(7)
    expect(rows[0].value).toBe(eur((1800 * 30) / 100))
  })
})

describe("conseils", () => {
  it("génère des conseils triés par sévérité pour chaque profil", () => {
    for (const p of ["prudent", "equilibre", "dynamique"] as const) {
      const S = computePortfolio(ctx, p)
      const adv = investAdvice(S, ctx)
      expect(adv.length).toBeGreaterThan(2)
      const order = { high: 0, mid: 1, good: 2, info: 3 }
      const sev = adv.map((a) => order[a.sev])
      expect([...sev].sort((a, b) => a - b)).toEqual(sev)
    }
  })
  it("détecte frais élevés, concentration, PEA disponible et biais domestique", () => {
    const S = computePortfolio(ctx, "equilibre")
    const titles = investAdvice(S, ctx).map((a) => a.title).join(" | ")
    expect(titles).toMatch(/frais élevés/)
    expect(titles).toMatch(/plafond PEA/)
    expect(titles).toMatch(/Technologie|Crypto|Émergents/)
  })
  it("épargne de précaution insuffisante", () => {
    const S = computePortfolio(ctx, "equilibre")
    const adv = investAdvice(S, { ...ctx, savingsBalance: 3000, monthlySpend: 4000 })
    expect(adv.some((a) => /reste à compléter/.test(a.text))).toBe(true)
  })
})

describe("constantes et formats", () => {
  it("expose les enveloppes et classes d'actifs", () => {
    expect(INV_KINDS.pea.ceiling).toBe(150000)
    expect(ASSETS.crypto.label).toBe("Crypto")
    expect(fxRate("XXX")).toBe(1)
  })
  it("formate les montants", () => {
    expect(eur(1234.4)).toBe("1 234 €")
    expect(eur(-0.2)).toBe("0 €")
    expect(eurS(-50)).toBe("− 50 €")
    expect(eurS(50)).toBe("+ 50 €")
    expect(pc(12.345, 1)).toBe("12,3 %")
    expect(pc(NaN)).toBe("0,0 %")
    expect(pcS(-2, 0)).toBe("−2 %")
    expect(pcS(2, 0)).toBe("+2 %")
    expect(num2(1234.5)).toBe("1 234,50")
    expect(initials("Sophie Lambert")).toBe("SL")
  })
})
