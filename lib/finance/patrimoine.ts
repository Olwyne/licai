import type { CtxLoan, CtxProperty, FinanceContext } from "./types"

// Immobilier : répartition du net, rentabilité locative (régime réel) — montants en euros.

export const PROP_COLORS = ["#1D9E75", "#378ADD", "#7C6BD6", "#EF9F27", "#D4537E"]

export const debtOf = (loans: CtxLoan[], p: CtxProperty): number => loans.filter((l) => l.propertyId === p.id).reduce((s, l) => s + l.left, 0)
export const monthlyOf = (loans: CtxLoan[], p: CtxProperty): number => loans.filter((l) => l.propertyId === p.id).reduce((s, l) => s + l.monthly, 0)

export interface ImmoSplitRow { id: string; name: string; net: number; w: number; color: string }
export interface ImmoPersonRow { id: string; net: number; w: number }

export function immoSplit(ctx: Pick<FinanceContext, "properties" | "loans" | "members">): { rows: ImmoSplitRow[]; persons: ImmoPersonRow[]; total: number } {
  const nets = ctx.properties.map((p) => ({ p, net: p.value - debtOf(ctx.loans, p) }))
  const total = nets.reduce((s, x) => s + x.net, 0)
  const base = total || 1
  const rows = nets.map(({ p, net }, i) => ({ id: p.id, name: p.name, net, w: (net / base) * 100, color: PROP_COLORS[i % PROP_COLORS.length] }))
  const persons = ctx.members
    .map((m) => {
      const net = nets.reduce((s, { p, net: n }) => s + n * ((p.shares[m.id] ?? 0) / 100), 0)
      return { id: m.id, net, w: (net / base) * 100 }
    })
    .filter((x) => x.net !== 0)
  return { rows, persons, total }
}

export interface RentYield {
  gross: number; vac: number; charges: number; interest: number; monthly: number
  base: number; net: number; taxable: number; tax: number; cashflow: number
  brut: number; nette: number; nn: number; onValue: number
}

/** Rentabilité d'un bien loué : régime réel, impôt au TMI + 17,2 % de prélèvements sociaux. */
export function yieldOf(p: CtxProperty, loans: CtxLoan[], tmi: number): RentYield {
  const c = p.costs
  const gross = p.rentMonthly * 12
  const vac = (gross * c.vacance) / 100
  const charges = c.copro + c.taxe + c.assur + c.gestion + c.travaux
  const cr = loans.filter((l) => l.propertyId === p.id)
  const monthly = cr.reduce((s, l) => s + l.monthly, 0)
  const interest = cr.reduce((s, l) => s + (l.left * l.rate) / 100, 0)
  const base = p.price + c.notaire
  const net = gross - vac - charges
  const taxable = Math.max(0, net - interest)
  const tax = taxable * (tmi / 100 + 0.172)
  const cashflow = (gross - vac - charges - monthly * 12 - tax) / 12
  return {
    gross, vac, charges, interest, monthly, base, net, taxable, tax, cashflow,
    brut: base ? (gross / base) * 100 : 0,
    nette: base ? (net / base) * 100 : 0,
    nn: base ? ((net - tax) / base) * 100 : 0,
    onValue: p.value ? ((net - tax) / p.value) * 100 : 0,
  }
}

export interface RentRow { p: CtxProperty; y: RentYield }
export interface CostRow { p: CtxProperty; cost: number; monthlyOut: number }

export function rentRows(ctx: Pick<FinanceContext, "properties" | "loans">, tmi: number): { rented: RentRow[]; others: CostRow[] } {
  const rented = ctx.properties.filter((p) => p.rentMonthly > 0).map((p) => ({ p, y: yieldOf(p, ctx.loans, tmi) }))
  const others = ctx.properties.filter((p) => !(p.rentMonthly > 0)).map((p) => {
    const c = p.costs
    const cost = c.copro + c.taxe + c.assur + c.travaux
    return { p, cost, monthlyOut: cost / 12 + monthlyOf(ctx.loans, p) }
  })
  return { rented, others }
}
