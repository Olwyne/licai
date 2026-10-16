import { db } from "@/lib/db"
import { baseBalanceCents, householdFx } from "@/lib/server/fx-convert"
import { transactions, categories, accounts, budgets, recurring, loans, properties, investments } from "@/db/schema"
import { eq, and, like, desc } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const url = new URL(req.url)
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7)

  const [yr, mo] = month.split("-").map(Number)
  const prevMo = mo === 1 ? 12 : mo - 1
  const prevYr = mo === 1 ? yr - 1 : yr
  const prevMonth = `${prevYr}-${String(prevMo).padStart(2, "0")}`

  // Fetch base data
  const [catRows, acctRows, budgetRows, recurringRows] = [
    db.select().from(categories).where(eq(categories.householdId, householdId)).all(),
    db.select().from(accounts).where(eq(accounts.householdId, householdId)).all(),
    db.select().from(budgets).where(and(eq(budgets.householdId, householdId), eq(budgets.month, month))).all(),
    db.select().from(recurring).where(eq(recurring.householdId, householdId)).all(),
  ]

  const catMap = new Map(catRows.map(c => [c.id, c]))
  const acctMap = new Map(acctRows.map(a => [a.id, a]))

  // Current month transactions
  const txRows = db.select().from(transactions)
    .where(and(eq(transactions.householdId, householdId), like(transactions.date, `${month}%`)))
    .all()

  // Previous month transactions
  const prevTxRows = db.select().from(transactions)
    .where(and(eq(transactions.householdId, householdId), like(transactions.date, `${prevMonth}%`)))
    .all()

  // KPIs — exclude transfers
  const totalIncomeCents = txRows.filter(t => t.kind === "income").reduce((s, t) => s + t.amountCents, 0)
  const totalExpenseCents = Math.abs(txRows.filter(t => t.kind === "expense").reduce((s, t) => s + t.amountCents, 0))
  const balanceCents = totalIncomeCents - totalExpenseCents
  const savingsRatePct = totalIncomeCents > 0 ? Math.round((balanceCents / totalIncomeCents) * 100) : 0

  // Previous month KPIs — exclude transfers
  const prevExpenseCents = Math.abs(prevTxRows.filter(t => t.kind === "expense").reduce((s, t) => s + t.amountCents, 0))

  // Trésorerie: sum of all account balances
  const tresorerieCents = acctRows.reduce((s, a) => s + baseBalanceCents(a, householdFx(householdId).fx), 0)

  // Recurring: charges fixes (non-saving, active)
  const activeRecurring = recurringRows.filter(r => r.active)
  const chargesFixesCents = activeRecurring
    .filter(r => r.kind !== "saving")
    .reduce((s, r) => s + frequencyToMonthlyCents(r.amountCents, r.frequency as "monthly" | "quarterly" | "annual"), 0)

  // Reste à vivre / jour
  const resteAVivreCents = Math.max(0, totalIncomeCents - chargesFixesCents) / 30

  // Panier moyen (avg expense transaction)
  const expenseTx = txRows.filter(t => t.kind === "expense")
  const panierMoyenCents = expenseTx.length > 0
    ? Math.abs(Math.round(expenseTx.reduce((s, t) => s + t.amountCents, 0) / expenseTx.length))
    : 0

  // Plus grosse dépense
  const plusGrosseDep = expenseTx.reduce<{ name: string; amountCents: number } | null>((max, t) => {
    if (!max || Math.abs(t.amountCents) > max.amountCents) {
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
      return { name: t.name, amountCents: Math.abs(t.amountCents), categoryLabel: cat?.label ?? "Autre" }
    }
    return max
  }, null)

  // Trésorerie variation vs prev month
  const prevExpTotal = prevTxRows.reduce((s, t) => s + t.amountCents, 0)
  const tresoVariationPct = prevExpTotal !== 0
    ? Math.round(((balanceCents) / Math.abs(prevExpTotal)) * 100)
    : 0

  // Dépense moy / jour
  const today = new Date().toISOString().slice(0, 10)
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const daysPassed = today.startsWith(month) ? parseInt(today.slice(8, 10)) : daysInMonth
  const depMoyJourCents = daysPassed > 0 ? Math.round(totalExpenseCents / daysPassed) : 0

  // By category (expenses only, no transfers)
  const byCatMap = new Map<string, number>()
  for (const t of txRows) {
    if (t.kind === "expense" && t.categoryId) {
      byCatMap.set(t.categoryId, (byCatMap.get(t.categoryId) ?? 0) + Math.abs(t.amountCents))
    }
  }
  const byCategory = [...byCatMap.entries()].map(([categoryId, amountCents]) => {
    const cat = catMap.get(categoryId)
    return { categoryId, label: cat?.label ?? "Autre", icon: cat?.icon ?? "ti-tag", colorHex: cat?.colorHex ?? "#888780", amountCents }
  }).sort((a, b) => b.amountCents - a.amountCents)

  // Cash flow: last 6 months
  const cashFlow: Array<{ month: string; incomeCents: number; expenseCents: number }> = []
  for (let i = 5; i >= 0; i--) {
    let m = mo - i
    let y = yr
    while (m <= 0) { m += 12; y-- }
    const mStr = `${y}-${String(m).padStart(2, "0")}`
    const monthTx = db.select().from(transactions)
      .where(and(eq(transactions.householdId, householdId), like(transactions.date, `${mStr}%`)))
      .all()
    cashFlow.push({
      month: mStr,
      incomeCents: monthTx.filter(t => t.kind === "income").reduce((s, t) => s + t.amountCents, 0),
      expenseCents: Math.abs(monthTx.filter(t => t.kind === "expense").reduce((s, t) => s + t.amountCents, 0)),
    })
  }

  // Last 8 transactions
  const lastTransactions = db.select().from(transactions)
    .where(eq(transactions.householdId, householdId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(8)
    .all()
    .map(t => {
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
      const acct = t.accountId ? acctMap.get(t.accountId) : undefined
      return {
        id: t.id, name: t.name, amountCents: t.amountCents, date: t.date,
        categoryLabel: cat?.label ?? "Autre", categoryIcon: cat?.icon ?? "ti-tag",
        categoryColor: cat?.colorHex ?? "#888780", accountName: acct?.name ?? "—",
      }
    })

  // Top 5 biggest expenses this month
  const topExpenses = [...expenseTx]
    .sort((a, b) => a.amountCents - b.amountCents)
    .slice(0, 5)
    .map(t => {
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
      return {
        id: t.id, name: t.name, amountCents: Math.abs(t.amountCents), date: t.date,
        categoryLabel: cat?.label ?? "Autre", categoryColor: cat?.colorHex ?? "#888780",
        pctOfTotal: totalExpenseCents > 0 ? Math.round((Math.abs(t.amountCents) / totalExpenseCents) * 100) : 0,
      }
    })

  // Upcoming recurring (next 30 days)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const upcomingRecurring = activeRecurring
    .filter(r => r.nextDate <= cutoffStr)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 7)
    .map(r => ({
      id: r.id, name: r.name, amountCents: r.amountCents,
      frequency: r.frequency, nextDate: r.nextDate, kind: r.kind,
      monthlyCents: frequencyToMonthlyCents(r.amountCents, r.frequency as "monthly" | "quarterly" | "annual"),
    }))

  // Signals
  const signals: Array<{ icon: string; label: string; desc: string; tone: "ok" | "warn" | "info" }> = []

  if (savingsRatePct >= 20) {
    signals.push({ icon: "ti-piggy-bank", label: `Taux d'épargne de ${savingsRatePct} %`, desc: `${Math.round(balanceCents / 100)} € mis de côté ce mois`, tone: "ok" })
  } else if (savingsRatePct > 0) {
    signals.push({ icon: "ti-piggy-bank", label: `Taux d'épargne de ${savingsRatePct} %`, desc: "En dessous des 20 % recommandés", tone: "warn" })
  }

  const overBudget = budgetRows.filter(b => {
    const spent = txRows.filter(t => t.categoryId === b.categoryId && t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0)
    return spent > b.limitCents
  })
  if (overBudget.length > 0) {
    const labels = overBudget.map(b => catMap.get(b.categoryId)?.label ?? "Catégorie").join(", ")
    signals.push({ icon: "ti-alert-triangle", label: `${overBudget.length} budget${overBudget.length > 1 ? "s" : ""} dépassé${overBudget.length > 1 ? "s" : ""}`, desc: labels, tone: "warn" })
  }

  const monthsDays = daysInMonth - daysPassed
  if (monthsDays > 0 && totalExpenseCents > 0) {
    const annualRate = Math.round((totalExpenseCents / daysPassed) * 365 / 100)
    signals.push({ icon: "ti-chart-line", label: `Rythme annualisé`, desc: `${annualRate.toLocaleString("fr-FR")} € au rythme actuel`, tone: "info" })
  }

  const coverage = tresorerieCents > 0 && totalExpenseCents > 0
    ? +(tresorerieCents / totalExpenseCents).toFixed(1)
    : 0
  if (coverage > 0) {
    signals.push({ icon: "ti-shield-check", label: `Couverture ${coverage} mois de dépenses`, desc: `Trésorerie ${Math.round(tresorerieCents / 100).toLocaleString("fr-FR")} € vs ${Math.round(totalExpenseCents / 100).toLocaleString("fr-FR")} €/mois`, tone: coverage >= 3 ? "ok" : "warn" })
  }

  // Taux d'endettement + Patrimoine net
  const loanRows = db.select().from(loans).where(eq(loans.householdId, householdId)).all()
  const propertyRows = db.select().from(properties).where(eq(properties.householdId, householdId)).all()

  const loanMensualitesCents = loanRows.reduce((s, l) => s + l.monthlyPaymentCents, 0)
  const revenuMensuelCents = activeRecurring
    .filter(r => r.amountCents > 0)
    .reduce((s, r) => s + frequencyToMonthlyCents(r.amountCents, r.frequency as "monthly" | "quarterly" | "annual"), 0)
  const tauxEndettementPct = revenuMensuelCents > 0
    ? Math.round((loanMensualitesCents / revenuMensuelCents) * 1000) / 10
    : null

  const propertyValueCents = propertyRows.reduce((s, p) => s + p.valueCents, 0)
  const loanRemainingCents = loanRows.reduce((s, l) => s + l.remainingCents, 0)
  const patrimoineNetCents = tresorerieCents + propertyValueCents - loanRemainingCents

  // Placements summary
  const investRows = db.select().from(investments).where(eq(investments.householdId, householdId)).all()
  const placementsTotalValueCents = investRows.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0)
  const placementsTotalPurchaseCents = investRows.reduce((s, i) => s + i.quantity * i.purchasePriceCents, 0)
  const placementsGainCents = placementsTotalValueCents - placementsTotalPurchaseCents
  const placementsGainPct = placementsTotalPurchaseCents > 0
    ? +((placementsGainCents / placementsTotalPurchaseCents) * 100).toFixed(1)
    : 0
  const placementsCount = investRows.length
  const placementsSummary = { totalValueCents: placementsTotalValueCents, totalPurchaseCents: placementsTotalPurchaseCents, gainCents: placementsGainCents, gainPct: placementsGainPct, count: placementsCount }

  // Budget summary
  const budgetSummary = budgetRows.map(b => {
    const cat = catMap.get(b.categoryId)
    const spentCents = txRows.filter(t => t.categoryId === b.categoryId && t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0)
    return { categoryId: b.categoryId, label: cat?.label ?? "Autre", icon: cat?.icon ?? "ti-tag", colorHex: cat?.colorHex ?? "#888780", limitCents: b.limitCents, spentCents }
  })

  return ok({
    month, totalIncomeCents, totalExpenseCents, balanceCents, savingsRatePct,
    tresorerieCents, chargesFixesCents, resteAVivreCents: Math.round(resteAVivreCents),
    depMoyJourCents, panierMoyenCents, plusGrosseDep,
    prevExpenseCents, nbExpenseTx: expenseTx.length,
    nbAccounts: acctRows.length,
    tauxEndettementPct, patrimoineNetCents,
    byCategory, cashFlow, lastTransactions,
    topExpenses, upcomingRecurring, signals,
    budgetSummary, placementsSummary,
  })
}
