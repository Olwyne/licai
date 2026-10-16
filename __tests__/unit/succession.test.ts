import { describe, it, expect } from "vitest"
import { computePortfolio } from "@/lib/finance/invest"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { envTax, householdNet, ifi, loanOwners, perPerson, psLines, pvRows, scale, succession, successionAdvice } from "@/lib/finance/succession"
import { ctx } from "./fixtures"

const S = computePortfolio(ctx, "equilibre")

describe("barèmes", () => {
  it("scale applique les tranches", () => {
    expect(scale(0, [[100, 10], [Infinity, 20]]).tax).toBe(0)
    expect(scale(150, [[100, 10], [Infinity, 20]]).tax).toBeCloseTo(10 + 10, 5)
  })
})

describe("patrimoine par personne", () => {
  it("répartit liquidités, placements, immobilier et dettes", () => {
    const list = perPerson(ctx, S)
    const sophie = list.find((p) => p.m.id === "s")!
    expect(sophie.cash).toBeCloseTo(5000 + 6000, 5)
    expect(sophie.immo).toBeCloseTo(140000 + 130000, 5)
    expect(sophie.debt).toBeCloseTo(142000 / 2 + 74000 + 3800 / 2, 5)
    expect(sophie.net).toBeCloseTo(sophie.cash + sophie.placed + sophie.immo - sophie.debt, 5)
  })
  it("la somme des patrimoines ≈ patrimoine du foyer (hors dettes sans propriétaire)", () => {
    const sum = perPerson(ctx, S).reduce((s, p) => s + p.net, 0)
    expect(sum).toBeCloseTo(householdNet(ctx, S), 0)
  })
  it("les dettes sans bien se répartissent entre adultes", () => {
    expect(loanOwners(ctx, null).sort()).toEqual(["s", "t"])
    expect(loanOwners(ctx, "p2")).toEqual(["s"])
  })
})

describe("succession", () => {
  it("conjoint exonéré, enfants taxés après abattement de 100 000 €", () => {
    const r = succession(ctx, S, "s")!
    expect(r.spouse?.id).toBe("t")
    expect(r.kids).toHaveLength(1)
    expect(r.rows.find((h) => h.spouse)!.tax).toBe(0)
    const kid = r.rows.find((h) => !h.spouse)!
    expect(kid.abat).toBeLessThanOrEqual(100000)
    expect(kid.share).toBeCloseTo(0.75, 8)
    expect(r.total).toBeCloseTo(r.rows.reduce((s, h) => s + h.tax, 0) + r.avRows.reduce((s, a) => s + a.tax, 0), 5)
  })
  it("l'assurance vie est hors succession, bénéficiaires désignés", () => {
    const r = succession(ctx, S, "s")!
    expect(r.avTotal).toBeGreaterThan(0)
    expect(r.avRows.map((a) => a.m.id).sort()).toEqual(["l", "t"])
    expect(r.avRows.find((a) => a.isSpouse)!.tax).toBe(0)
    expect(r.estate).toBeCloseTo(Math.max(0, r.P.net - r.avTotal), 5)
  })
  it("taxe l'assurance vie au-delà de 152 500 € par bénéficiaire", () => {
    const rich = { ...ctx, holdings: ctx.holdings.map((h) => (h.id === "h1" ? { ...h, qty: 900000 } : h)) }
    const r = succession(rich, computePortfolio(rich, "equilibre"), "s")!
    expect(r.avRows.find((a) => !a.isSpouse)!.tax).toBeGreaterThan(0)
  })
  it("sans conjoint ni enfant", () => {
    const solo = { ...ctx, members: [ctx.members[0]] }
    const r = succession(solo, S, "s")!
    expect(r.rows).toHaveLength(0)
    expect(succession(ctx, S, "inconnu")).toBeNull()
  })
  it("sans conjoint, les enfants héritent de tout", () => {
    const r = succession({ ...ctx, members: [ctx.members[0], ctx.members[2]] }, S, "s")!
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].share).toBe(1)
  })
  it("pistes de transmission", () => {
    const r = succession(ctx, S, "s")!
    expect(successionAdvice(r, 900).length).toBeGreaterThanOrEqual(3)
    const big = successionAdvice({ ...r, estate: 900000 }, 0)
    expect(big.some((a) => /Démembrement/.test(a.title))).toBe(true)
    const sat = successionAdvice({ ...r, avTotal: 9e6 }, 0)
    expect(sat.find((a) => /Enveloppe/.test(a.title))!.sev).toBe("mid")
  })
})

describe("IFI", () => {
  it("non redevable sous 1,3 M€", () => {
    const r = ifi(ctx, S)
    expect(r.rp).toBe(280000)
    expect(r.other).toBe(130000)
    expect(r.debt).toBe(216000)
    expect(r.liable).toBe(false)
    expect(r.tax).toBe(0)
    expect(r.crossYear).toMatch(/\d{4}|au-delà/)
  })
  it("redevable au-dessus du seuil", () => {
    const rich = { ...ctx, properties: ctx.properties.map((p) => ({ ...p, value: p.value * 8 })) }
    const r = ifi(rich, S)
    expect(r.liable).toBe(true)
    expect(r.tax).toBeGreaterThan(0)
  })
})

describe("fiscalité de sortie", () => {
  it("règles par enveloppe", () => {
    expect(envTax("pea", 6, 1000, 30).t).toBeCloseTo(172, 5)
    expect(envTax("pea", 2, 1000, 30).t).toBeCloseTo(302, 5)
    expect(envTax("av", 9, 10000, 30).t).toBeCloseTo((10000 - 4600) * 0.075 + 1720, 5)
    expect(envTax("av", 3, 1000, 30).t).toBeCloseTo(302, 5)
    expect(envTax("per", 3, 1000, 30).t).toBeCloseTo(300, 5)
    expect(envTax("pee", 6, 1000, 30).t).toBeCloseTo(172, 5)
    expect(envTax("pee", 2, 1000, 30).t).toBeCloseTo(172, 5)
    expect(envTax("cto", 3, 1000, 30).t).toBeCloseTo(300, 5)
    expect(envTax("cto", 3, 1000, 5).t).toBeCloseTo(222, 5)
    expect(envTax("crypto", 3, 1000, 41).l).toMatch(/Flat tax|Barème/)
  })
  it("plus-values latentes par enveloppe, avec économie si on attend", () => {
    const r = pvRows(ctx, S, 30)
    expect(r.rows).toHaveLength(6)
    const pea = r.rows.find((x) => x.id === "pea")!
    expect(pea.wait).toBe(3)
    expect(r.tot.v).toBeCloseTo(r.rows.reduce((s, x) => s + x.value, 0), 5)
    expect(r.gainsWait).toBeGreaterThanOrEqual(0)
  })
  it("prélèvements sociaux & acomptes", () => {
    const T = computeTax(taxInputs(ctx), situationFor(ctx))
    const lines = psLines(T, S.pv)
    expect(lines).toHaveLength(6)
    expect(lines[5].cls).toBe("neg")
    expect(lines[2].value).toContain("€")
  })
})
