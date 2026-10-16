import { db } from "@/lib/db"
import { recurring, transactions, accounts, budgets, categories } from "@/db/schema"
import { eq, and, gte } from "drizzle-orm"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"

export type RecurringEvent = {
  name: string
  amountCents: number
  kind: string
  month: string
}

export type MonthForecast = {
  month: string
  incomeCents: number
  chargesFixesCents: number
  variableCents: number
  exceptionnelCents: number
  epargne: number
  netCents: number
  runningBalanceCents: number
  recurringEvents: RecurringEvent[]
}

export type BudgetVsReel = {
  categoryId: string
  label: string
  colorHex: string
  avgSpentCents: number
  limitCents: number
  trend: "up" | "down" | "stable"
}

export type PrevisionData = {
  months: MonthForecast[]
  kpi: {
    soldeProjete: number
    moisLePlusTendu: string
    soldeMoisTendu: number
    depensesExceptionnellesCents: number
    epargneTotaleCents: number
    tresorerieCents: number
    matelasConseille: number
  }
  budgetVsReel: BudgetVsReel[]
}

const FREQ = { monthly: 1, quarterly: 3, annual: 12 } as const

function monthApplies(item: { frequency: string; nextDate: string }, year: number, monthIdx: number): boolean {
  const nextD = new Date(item.nextDate)
  if (item.frequency === "monthly") return true
  if (item.frequency === "quarterly") {
    const forecastAbs = year * 12 + monthIdx
    const nextAbs = nextD.getFullYear() * 12 + nextD.getMonth()
    return (forecastAbs - nextAbs) % 3 === 0
  }
  if (item.frequency === "annual") return monthIdx === nextD.getMonth()
  return false
}

export function buildPrevisions(householdId: string, horizon: number): PrevisionData {
  const now = new Date()

  const [activeRecurring, acctRows, budgetRows, catRows] = [
    db.select().from(recurring).where(and(eq(recurring.householdId, householdId), eq(recurring.active, true))).all(),
    db.select().from(accounts).where(eq(accounts.householdId, householdId)).all(),
    db.select().from(budgets).where(eq(budgets.householdId, householdId)).all(),
    db.select().from(categories).where(eq(categories.householdId, householdId)).all(),
  ]

  const catMap = new Map(catRows.map(c => [c.id, c]))
  const tresorerieCents = acctRows.reduce((s, a) => s + (a.balanceCents ?? 0), 0)

  // Historical avg from past 3 months (variable expenses only — non-recurring)
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
  const pastTx = db.select().from(transactions)
    .where(and(eq(transactions.householdId, householdId), gte(transactions.date, threeMonthsAgo)))
    .all()

  const histIncomeCents = Math.round(pastTx.filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0) / 3)
  const histVariableCents = Math.round(Math.abs(pastTx.filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0)) / 3)

  // Monthly charges fixes (recurring non-saving, monthly only)
  const chargesFixesMonthlyCents = activeRecurring
    .filter(r => r.kind !== "saving" && r.frequency === "monthly")
    .reduce((s, r) => s + r.amountCents, 0)

  // Matelas conseillé = 1 month of charges fixes
  const matelasConseille = chargesFixesMonthlyCents

  // Build month forecasts
  const months: MonthForecast[] = []
  let runningBalance = tresorerieCents
  let totalExceptionnel = 0
  let totalEpargne = 0

  for (let m = 0; m < horizon; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1)
    const year = d.getFullYear()
    const monthIdx = d.getMonth()
    const forecastMonth = `${year}-${String(monthIdx + 1).padStart(2, "0")}`

    let chargesFixesCents = 0
    let epargne = 0
    let exceptionnelCents = 0
    const events: RecurringEvent[] = []

    for (const item of activeRecurring) {
      if (!monthApplies(item, year, monthIdx)) continue
      const amt = item.amountCents

      if (item.kind === "saving") {
        epargne += amt
      } else if (item.frequency === "monthly") {
        chargesFixesCents += amt
      } else {
        // quarterly or annual = exceptionnel
        exceptionnelCents += amt
      }
      events.push({ name: item.name, amountCents: amt, kind: item.kind, month: forecastMonth })
    }

    totalEpargne += epargne
    totalExceptionnel += exceptionnelCents

    const incomeCents = histIncomeCents
    const variableCents = histVariableCents
    const netCents = incomeCents - chargesFixesCents - variableCents - exceptionnelCents - epargne
    runningBalance += netCents

    months.push({
      month: forecastMonth,
      incomeCents,
      chargesFixesCents,
      variableCents,
      exceptionnelCents,
      epargne,
      netCents,
      runningBalanceCents: runningBalance,
      recurringEvents: events,
    })
  }

  // KPIs
  const soldeProjete = months[months.length - 1]?.runningBalanceCents ?? tresorerieCents
  const tightest = months.reduce((min, m) => m.runningBalanceCents < min.runningBalanceCents ? m : min, months[0])
  const moisLePlusTendu = tightest?.month ?? ""
  const soldeMoisTendu = tightest?.runningBalanceCents ?? 0

  // Budget vs réel: compare avg spending (past 3 months) vs budget limit
  const budgetMap = new Map<string, number>()
  for (const b of budgetRows) {
    const existing = budgetMap.get(b.categoryId) ?? 0
    budgetMap.set(b.categoryId, Math.max(existing, b.limitCents))
  }

  // Group past tx by category for avg
  const catSpend = new Map<string, number[]>()
  for (const t of pastTx) {
    if (t.amountCents < 0 && t.categoryId) {
      const monthKey = t.date.slice(0, 7)
      const key = `${t.categoryId}:${monthKey}`
      // group by (cat, month)
      if (!catSpend.has(t.categoryId)) catSpend.set(t.categoryId, [])
      catSpend.get(t.categoryId)!.push(Math.abs(t.amountCents))
    }
  }

  const budgetVsReel: BudgetVsReel[] = []
  for (const [catId, limitCents] of budgetMap.entries()) {
    const spends = catSpend.get(catId) ?? []
    const avgSpentCents = spends.length > 0 ? Math.round(spends.reduce((s, v) => s + v, 0) / 3) : 0
    const cat = catMap.get(catId)
    budgetVsReel.push({
      categoryId: catId,
      label: cat?.label ?? "Autre",
      colorHex: cat?.colorHex ?? "#888780",
      avgSpentCents,
      limitCents,
      trend: avgSpentCents > limitCents ? "up" : avgSpentCents < limitCents * 0.8 ? "down" : "stable",
    })
  }

  return {
    months,
    kpi: {
      soldeProjete,
      moisLePlusTendu,
      soldeMoisTendu,
      depensesExceptionnellesCents: totalExceptionnel,
      epargneTotaleCents: totalEpargne,
      tresorerieCents,
      matelasConseille,
    },
    budgetVsReel,
  } satisfies PrevisionData
}
