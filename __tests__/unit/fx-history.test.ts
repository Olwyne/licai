import { describe, expect, it } from "vitest"
import { DEFAULT_FX } from "@/lib/finance/fx"
import { fxGain, pickRate, type FxSnapshot } from "@/lib/finance/fx-history"

const snap = (date: string, jpy: number, base = "EUR"): FxSnapshot => ({ date, base, rates: { ...DEFAULT_FX, JPY: jpy, [base]: 1 } })

describe("historique des taux", () => {
  const snaps = [snap("2026-03-01", 0.0060), snap("2026-06-01", 0.0055), snap("2026-09-01", 0.0050)]
  it("prend le relevé le plus récent au plus tard à la date de l'opération", () => {
    expect(pickRate(snaps, "JPY", "2026-06-15", "EUR", 0.1)).toBe(0.0055)
    expect(pickRate(snaps, "JPY", "2026-09-01", "EUR", 0.1)).toBe(0.0050)
    expect(pickRate(snaps, "JPY", "2026-12-31", "EUR", 0.1)).toBe(0.0050)
  })
  it("avant le premier relevé : le plus ancien ; sans historique : le taux courant", () => {
    expect(pickRate(snaps, "JPY", "2025-01-01", "EUR", 0.1)).toBe(0.0060)
    expect(pickRate([], "JPY", "2026-06-15", "EUR", 0.00591)).toBe(0.00591)
  })
  it("la devise de référence vaut toujours 1", () => {
    expect(pickRate(snaps, "EUR", "2026-06-15", "EUR", 9)).toBe(1)
  })
  it("ramène un relevé pris dans une autre devise de référence", () => {
    // relevé en USD : 1 EUR = 1/0,882 USD ; en base EUR, le yen vaut JPY(USD) / EUR(USD)
    const usd: FxSnapshot = { date: "2026-01-01", base: "USD", rates: { ...DEFAULT_FX, USD: 1, EUR: 1.1, JPY: 0.0066 } }
    expect(pickRate([usd], "JPY", "2026-02-01", "EUR", 0)).toBeCloseTo(0.0066 / 1.1, 8)
  })
})

describe("écart de change", () => {
  it("solde natif × (taux actuel − taux à l'ouverture)", () => {
    const g = fxGain(10_000_000, 0.0066, 0.006)! // 100 000 ¥
    expect(g.cents).toBe(Math.round(10_000_000 * 0.0006))
    expect(g.pct).toBeCloseTo(10, 6)
  })
  it("perte quand la devise baisse ; null sans taux d'ouverture", () => {
    expect(fxGain(1_000_000, 0.005, 0.006)!.cents).toBeLessThan(0)
    expect(fxGain(1_000_000, 0.005, null)).toBeNull()
    expect(fxGain(1_000_000, 0.005, 0)).toBeNull()
  })
})
