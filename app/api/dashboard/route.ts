import { db } from "@/lib/db"
import { transactions, categories, accounts, budgets } from "@/db/schema"
import { eq, and, like, desc } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const url = new URL(req.url)
  const month = url.searchParams.get("month") ?? "2026-06"

  // All transactions for the month
  const txRows = db.select().from(transactions)
    .where(and(
      eq(transactions.householdId, householdId),
      like(transactions.date, `${month}%`)
    ))
    .all()

  const catRows = db.select().from(categories).where(eq(categories.householdId, householdId)).all()
  const acctRows = db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
  const budgetRows = db.select().from(budgets)
    .where(and(eq(budgets.householdId, householdId), eq(budgets.month, month)))
    .all()

  const catMap = new Map(catRows.map(c => [c.id, c]))
  const acctMap = new Map(acctRows.map(a => [a.id, a]))

  // KPIs
  const totalIncomeCents = txRows.filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0)
  const totalExpenseCents = Math.abs(txRows.filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0))
  const balanceCents = totalIncomeCents - totalExpenseCents
  const savingsRatePct = totalIncomeCents > 0 ? Math.round((balanceCents / totalIncomeCents) * 100) : 0

  // By category (expenses only)
  const byCatMap = new Map<string, number>()
  for (const t of txRows) {
    if (t.amountCents < 0 && t.categoryId) {
      byCatMap.set(t.categoryId, (byCatMap.get(t.categoryId) ?? 0) + Math.abs(t.amountCents))
    }
  }
  const byCategory = [...byCatMap.entries()].map(([categoryId, amountCents]) => {
    const cat = catMap.get(categoryId)
    return {
      categoryId,
      label: cat?.label ?? "Autre",
      icon: cat?.icon ?? "ti-tag",
      colorHex: cat?.colorHex ?? "#888780",
      amountCents,
    }
  }).sort((a, b) => b.amountCents - a.amountCents)

  // Cash flow: last 6 months
  const cashFlow: Array<{ month: string; incomeCents: number; expenseCents: number }> = []
  const [yr, mo] = month.split("-").map(Number)
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
      incomeCents: monthTx.filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0),
      expenseCents: Math.abs(monthTx.filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0)),
    })
  }

  // Last 5 transactions
  const lastTransactions = db.select().from(transactions)
    .where(and(eq(transactions.householdId, householdId), like(transactions.date, `${month}%`)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(5)
    .all()
    .map(t => {
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
      const acct = t.accountId ? acctMap.get(t.accountId) : undefined
      return {
        id: t.id,
        name: t.name,
        amountCents: t.amountCents,
        date: t.date,
        categoryLabel: cat?.label ?? "Autre",
        categoryIcon: cat?.icon ?? "ti-tag",
        categoryColor: cat?.colorHex ?? "#888780",
        accountName: acct?.name ?? "—",
      }
    })

  // Budget summary
  const budgetSummary = budgetRows.map(b => {
    const cat = catMap.get(b.categoryId)
    const spentCents = txRows
      .filter(t => t.categoryId === b.categoryId && t.amountCents < 0)
      .reduce((s, t) => s + Math.abs(t.amountCents), 0)
    return {
      categoryId: b.categoryId,
      label: cat?.label ?? "Autre",
      icon: cat?.icon ?? "ti-tag",
      colorHex: cat?.colorHex ?? "#888780",
      limitCents: b.limitCents,
      spentCents,
    }
  })

  return ok({ month, totalIncomeCents, totalExpenseCents, balanceCents, savingsRatePct, byCategory, cashFlow, lastTransactions, budgetSummary })
}
