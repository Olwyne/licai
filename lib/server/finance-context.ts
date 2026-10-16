import { db } from "@/lib/db"
import { members, accounts, properties, propertyOwners, loans, investmentAccounts, investments, portfolioSnapshots, transactions, households } from "@/db/schema"
import { eq, and, gte, inArray, asc } from "drizzle-orm"
import { randomUUID } from "crypto"
import type { AssetClass, CtxLoan, CtxProperty, FinanceContext, InvKind, ResidenceType } from "@/lib/finance/types"
import { fxRate, mergeFx } from "@/lib/finance/fx"

const parseIds = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [] } catch { return [] }
}
const parseObj = (s: string): Record<string, unknown> => {
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v : {} } catch { return {} }
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0)
function parseCosts(raw: string, taxe: number): CtxProperty["costs"] {
  const o = parseObj(raw)
  return { copro: num(o.copro), assur: num(o.assur), gestion: num(o.gestion), travaux: num(o.travaux), vacance: num(o.vacance), notaire: num(o.notaire), taxe }
}

export function buildFinanceContext(householdId: string): FinanceContext {
  const now = new Date()

  const mem = db.select().from(members).where(eq(members.householdId, householdId)).all()
  const accs = db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
  const props = db.select().from(properties).where(and(eq(properties.householdId, householdId), eq(properties.kind, "immobilier"))).all()
  const owners = props.length ? db.select().from(propertyOwners).where(inArray(propertyOwners.propertyId, props.map((p) => p.id))).all() : []
  const loanRows = db.select().from(loans).where(eq(loans.householdId, householdId)).all()
  const invAccs = db.select().from(investmentAccounts).where(eq(investmentAccounts.householdId, householdId)).all()
  const invs = db.select().from(investments).where(eq(investments.householdId, householdId)).all()
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()

  const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10)
  const spent = db.select({ a: transactions.amountCents }).from(transactions)
    .where(and(eq(transactions.householdId, householdId), eq(transactions.kind, "expense"), gte(transactions.date, cutoff))).all()
  const monthlySpend = spent.reduce((s, t) => s + Math.abs(t.a), 0) / 100 / 3

  const fx = mergeFx(parseObj(hh?.fxRates ?? "{}"))
  const cash = accs.filter((a) => a.type !== "investment").map((a) => ({
    id: a.id, name: a.name, type: a.type, currency: a.currency, native: a.balanceCents / 100,
    balance: (a.balanceCents / 100) * fxRate(a.currency, fx),
    ownerIds: parseIds(a.ownerIds),
  }))

  const propsOut = props.map((p) => {
    const shares: Record<string, number> = {}
    owners.filter((o) => o.propertyId === p.id).forEach((o) => (shares[o.memberId] = o.sharePercent))
    const type: ResidenceType = (["principale", "secondaire", "locatif"].includes(p.residenceType) ? p.residenceType : "principale") as ResidenceType
    return {
      id: p.id, name: p.name, city: p.address, type,
      value: p.valueCents / 100, price: p.purchasePriceCents / 100,
      rentMonthly: p.rentMonthlyCents / 100,
      costs: parseCosts(p.costs, p.taxeFonciereCents / 100),
      estimatedAt: p.lastEstimatedAt ?? null, estimateSource: p.estimateSource,
      surface: p.surfaceSqm ?? null, shares,
    }
  })

  const loansOut: CtxLoan[] = loanRows.map((l) => ({
    id: l.id, name: l.name, kind: l.kind, left: l.remainingCents / 100,
    monthly: l.monthlyPaymentCents / 100, rate: l.ratePercent, propertyId: l.propertyId ?? null, endDate: l.endDate ?? null,
  }))

  const invAccOut = invAccs.map((a) => ({
    id: a.id, kind: a.kind as InvKind, name: a.name, bank: a.bank,
    ownerIds: parseIds(a.ownerIds), benefIds: parseIds(a.benefIds), since: a.sinceYear,
    paid: a.paidCents / 100, monthly: a.monthlyCents / 100, fees: a.feesPct, match: a.matchPct,
  }))

  const holdings = invs.map((i) => ({
    id: i.id, acct: i.accountId ?? null, name: i.name, tk: i.ticker || i.name.slice(0, 6).toUpperCase(),
    cls: i.assetClass as AssetClass, zone: i.zone, sector: i.sector, cur: i.currency, cap: i.cap,
    qty: i.quantity, pru: i.purchasePriceCents / 100, price: i.unitPriceCents / 100,
    prev: i.prevPriceCents != null ? i.prevPriceCents / 100 : null,
    ter: i.terPct, gain: i.gainCents != null ? i.gainCents / 100 : null,
  }))

  // Instantané du mois en cours (valeur aux cours enregistrés), puis historique des 6 derniers mois
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const totalNow = Math.round(holdings.reduce((s, h) => s + h.qty * h.price * fxRate(h.cur, fx), 0) * 100)
  if (holdings.length) {
    const cur = db.select().from(portfolioSnapshots).where(and(eq(portfolioSnapshots.householdId, householdId), eq(portfolioSnapshots.ym, ym))).get()
    if (!cur) db.insert(portfolioSnapshots).values({ id: randomUUID(), householdId, ym, valueCents: totalNow, benchIndex: null }).run()
    else if (cur.valueCents !== totalNow) db.update(portfolioSnapshots).set({ valueCents: totalNow }).where(eq(portfolioSnapshots.id, cur.id)).run()
  }
  const snaps = db.select().from(portfolioSnapshots).where(eq(portfolioSnapshots.householdId, householdId)).orderBy(asc(portfolioSnapshots.ym)).all().slice(-6)

  return {
    fx, fxSource: (["demo", "manual", "api"].includes(hh?.fxSource ?? "") ? hh!.fxSource : "demo") as FinanceContext["fxSource"], fxTs: hh?.fxTs ?? "",
    history: snaps.map((s) => ({ ym: s.ym, value: s.valueCents / 100, bench: s.benchIndex })),
    year: now.getFullYear(), month: now.getMonth() + 1,
    members: mem.map((m) => ({
      id: m.id, name: m.name, short: m.short, role: m.role, color: m.colorHex,
      incomeMonthly: m.monthlyIncomeCents / 100, birthYear: m.birthYear ?? null, isChild: m.isChild,
    })),
    cash, properties: propsOut, loans: loansOut, invAccounts: invAccOut, holdings,
    monthlySpend,
    savingsBalance: cash.filter((a) => a.type === "savings").reduce((s, a) => s + a.balance, 0),
    taxSituation: parseObj(hh?.taxSituation ?? "{}") as FinanceContext["taxSituation"],
  }
}
