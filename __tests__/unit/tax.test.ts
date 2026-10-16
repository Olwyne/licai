import { describe, it, expect } from "vitest"
import { BRACKETS, bareme, computeTax, marginal, mergeSituation, situationFor, taxAdvice, taxContextNumbers, taxInputs, taxScenarios, DEFAULT_SITUATION } from "@/lib/finance/tax"
import { ctx } from "./fixtures"

describe("barème", () => {
  it("applique les tranches par part", () => {
    expect(bareme(10000).tax).toBe(0)
    expect(bareme(20000).tax).toBeCloseTo((20000 - 11497) * 0.11, 5)
    const big = bareme(200000)
    expect(big.detail).toHaveLength(5)
    expect(big.tax).toBeCloseTo(big.detail.reduce((s, d) => s + d.tax, 0), 5)
  })
  it("renvoie la tranche marginale", () => {
    expect(marginal(5000)).toBe(0)
    expect(marginal(20000)).toBe(11)
    expect(marginal(50000)).toBe(30)
    expect(marginal(100000)).toBe(41)
    expect(marginal(500000)).toBe(45)
    expect(BRACKETS[0][1]).toBe(0)
  })
})

describe("situation fiscale", () => {
  it("déduit les personnes à charge des membres enfants", () => {
    const s = situationFor(ctx)
    expect(s.couple).toBe(true)
    expect(s.dependents).toBe(1)
    expect(s.youngKids).toBe(1)
  })
  it("la saisie surcharge les valeurs par défaut", () => {
    expect(situationFor({ ...ctx, taxSituation: { dependents: 3, couple: false } }).dependents).toBe(3)
    expect(mergeSituation(undefined)).toEqual(DEFAULT_SITUATION)
  })
})

describe("computeTax", () => {
  const inp = taxInputs(ctx)
  const sit = situationFor(ctx)

  it("reprend salaires, loyers, intérêts et PER des autres écrans", () => {
    expect(inp.salaries.map((s) => s.annual)).toEqual([28800, 24600])
    expect(inp.loyers).toBe(7680)
    expect(inp.interetsLocatif).toBeCloseTo((74000 * 1.9) / 100, 5)
    expect(inp.perVerse).toBe(1800)
  })

  it("calcule un impôt cohérent", () => {
    const R = computeTax(inp, sit)
    expect(R.parts).toBe(2.5)
    expect(R.salTotal).toBe(53400)
    expect(R.abat).toBeCloseTo(2880 + 2460, 5)
    expect(R.rni).toBeGreaterThan(0)
    expect(R.irNet).toBeGreaterThanOrEqual(0)
    expect(R.totalPrel).toBeCloseTo(R.irNet + R.psFoncier + R.psCapitaux + R.irCapitaux, 5)
    expect(R.tauxGlobal).toBeGreaterThanOrEqual(R.tauxMoyen)
    expect(R.plafondPer).toBeGreaterThanOrEqual(4637)
  })

  it("le micro-foncier applique 30 % d'abattement", () => {
    const R = computeTax(inp, sit, { foncier: "micro" })
    expect(R.foncier).toBeCloseTo(7680 * 0.7, 5)
  })

  it("le déficit foncier est plafonné et imputé", () => {
    const R = computeTax(inp, sit, { travaux: 50000 })
    expect(R.foncier).toBeLessThan(0)
    expect(R.deficit).toBe(10700)
  })

  it("frais réels remplacent l'abattement de 10 %", () => {
    expect(computeTax(inp, sit, { fraisReels: 9000 }).abat).toBe(9000)
  })

  it("réductions : dons, services à domicile, garde", () => {
    const R = computeTax(inp, sit, { dons: 1000, domicile: 2500, garde: 2000, autres: 100 })
    expect(R.redDons).toBeCloseTo(660, 5)
    expect(R.redDom).toBe(1250)
    expect(R.redGarde).toBe(1000)
    expect(R.reductions).toBeCloseTo(660 + 1250 + 1000 + 100, 5)
  })

  it("plafonne le quotient familial et applique la décote", () => {
    const rich = computeTax({ ...inp, salaries: [{ id: "a", short: "A", annual: 150000 }, { id: "b", short: "B", annual: 120000 }] }, { ...sit, dependents: 4 })
    expect(rich.qfCapped).toBeGreaterThan(0)
    const modest = computeTax({ ...inp, salaries: [{ id: "a", short: "A", annual: 32000 }], loyers: 0, interetsLocatif: 0, perVerse: 0 }, { ...sit, couple: false, dependents: 0 })
    expect(modest.decote).toBeGreaterThanOrEqual(0)
  })

  it("compte 1 part pour une personne seule et gère 3 personnes à charge", () => {
    expect(computeTax(inp, { ...sit, couple: false, dependents: 0 }).parts).toBe(1)
    expect(computeTax(inp, { ...sit, couple: true, dependents: 3 }).parts).toBe(4)
  })

  it("sans revenu, les taux restent finis", () => {
    const R = computeTax({ salaries: [], loyers: 0, interetsLocatif: 0, perVerse: 0 }, sit)
    expect(R.tauxMoyen).toBe(0)
    expect(R.pasRate).toBe(0)
    expect(Number.isFinite(R.tmi)).toBe(true)
  })
})

describe("pistes d'optimisation", () => {
  const inp = taxInputs(ctx)
  it("liste des pistes triées par gain décroissant", () => {
    const R = computeTax(inp, situationFor(ctx))
    const { list, totalGain } = taxAdvice(ctx, inp, R)
    expect(list.length).toBeGreaterThan(3)
    const gains = list.map((a) => a.gain ?? 0)
    expect([...gains].sort((a, b) => b - a)).toEqual(gains)
    expect(totalGain).toBeCloseTo(gains.reduce((s, g) => s + g, 0), 5)
  })
  it("couvre les branches : micro, séparé, TMI bas, dividendes, enfants", () => {
    const base = situationFor(ctx)
    for (const over of [
      { foncier: "micro" as const, chargesFoncieres: 8000 }, { foncier: "micro" as const }, { foncier: "reel" as const, chargesFoncieres: 0 },
      { couple: false }, { dividendes: 500, garde: 0, youngKids: 2 }, { dependents: 5 },
    ]) {
      const s = { ...base, ...over }
      const R = computeTax(inp, s)
      expect(taxAdvice(ctx, inp, R).list.length).toBeGreaterThan(0)
    }
    const low = taxInputs({ ...ctx, members: [{ ...ctx.members[0], incomeMonthly: 1500 }] })
    const R = computeTax(low, { ...base, couple: false })
    expect(R.tmi).toBeLessThanOrEqual(11)
    expect(taxAdvice(ctx, low, R).list.some((a) => /PER peu rentable/.test(a.title))).toBe(true)
  })
  it("compare les scénarios à la situation actuelle", () => {
    const R = computeTax(inp, situationFor(ctx))
    const sc = taxScenarios(inp, R)
    expect(sc[0].diff).toBe(0)
    expect(sc.find((s) => s.label === "Plafond PER saturé")!.result.rni).toBeLessThanOrEqual(R.rni)
    expect(sc.find((s) => /dons/.test(s.label))!.diff).toBeLessThanOrEqual(0)
  })
  it("chiffres de contexte (taxe foncière, base IFI, exonéré)", () => {
    const n = taxContextNumbers(ctx)
    expect(n.taxeFonciere).toBeCloseTo((280000 + 130000) * 0.008, 5)
    expect(n.ifiBase).toBe(410000 - 216000)
    expect(n.exonere).toBeCloseTo(150, 5)
  })
})
