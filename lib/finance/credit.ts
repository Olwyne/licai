import type { FinanceContext } from "./types"

// Capacité d'emprunt (limite HCSF : 35 % de charges) — montants en euros.

export interface CapacityInputs { rate: number; years: number; apport: number }
export const DEFAULT_CAPACITY: CapacityInputs = { rate: 3.4, years: 20, apport: 30000 }

/** Capital empruntable pour une mensualité donnée. */
export function borrowable(monthly: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12
  if (monthly <= 0) return 0
  if (!r) return monthly * months
  return (monthly * (1 - Math.pow(1 + r, -months))) / r
}

export interface CapacityResult {
  sal: number; rents: number; charges: number; rentalCharge: number
  revClassic: number; ratioClassic: number; revDiff: number; chargeDiff: number; ratioDiff: number
  maxDiff: number; maxClassic: number; best: number; borrow: number; budget: number
}

export function capacity(ctx: Pick<FinanceContext, "members" | "properties" | "loans">, c: CapacityInputs): CapacityResult {
  const sal = ctx.members.filter((m) => !m.isChild).reduce((s, m) => s + m.incomeMonthly, 0)
  const rents = ctx.properties.reduce((s, p) => s + p.rentMonthly, 0)
  const charges = ctx.loans.reduce((s, l) => s + l.monthly, 0)
  const rentedIds = new Set(ctx.properties.filter((p) => p.rentMonthly > 0).map((p) => p.id))
  const rentalCharge = ctx.loans.filter((l) => l.propertyId && rentedIds.has(l.propertyId)).reduce((s, l) => s + l.monthly, 0)
  // méthode classique : loyers pondérés à 70 %, toutes les charges au dénominateur
  const revClassic = sal + rents * 0.7
  const ratioClassic = revClassic ? (charges / revClassic) * 100 : 0
  // méthode différentiel : le loyer net paie sa propre mensualité
  const revDiff = sal + Math.max(0, rents - rentalCharge)
  const chargeDiff = charges - rentalCharge
  const ratioDiff = revDiff ? (chargeDiff / revDiff) * 100 : 0
  const maxDiff = revDiff * 0.35 - chargeDiff
  const maxClassic = revClassic * 0.35 - charges
  const best = Math.max(maxDiff, maxClassic)
  const borrow = best > 0 ? borrowable(best, c.rate, c.years * 12) : 0
  const budget = borrow > 0 ? (borrow + c.apport) * 0.925 : 0 // ≈ 7,5 % de frais de notaire et garantie
  return { sal, rents, charges, rentalCharge, revClassic, ratioClassic, revDiff, chargeDiff, ratioDiff, maxDiff, maxClassic, best, borrow, budget }
}

/**
 * Taux d'endettement de référence du foyer (méthode classique HCSF : loyers pondérés à 70 %), utilisé partout (tableau de bord, crédits).
 * `null` si le foyer n'a aucun revenu déclaré.
 */
export function debtRatio(ctx: Pick<FinanceContext, "members" | "properties" | "loans">): number | null {
  const c = capacity(ctx, DEFAULT_CAPACITY)
  return c.revClassic > 0 ? c.ratioClassic : null
}
