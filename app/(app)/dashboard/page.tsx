import { db } from "@/lib/db"
import { transactions, categories, accounts, budgets } from "@/db/schema"
import { eq, and, like, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/features/dashboard/DashboardClient"
import type { DashboardData } from "@/components/features/dashboard/DashboardClient"

const DEFAULT_MONTH = new Date().toISOString().slice(0, 7)

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId

  const txRows = db.select().from(transactions)
    .where(and(eq(transactions.householdId, hid), like(transactions.date, `${DEFAULT_MONTH}%`)))
    .all()

  const catRows = db.select().from(categories).where(eq(categories.householdId, hid)).all()
  const acctRows = db.select().from(accounts).where(eq(accounts.householdId, hid)).all()
  const budgetRows = db.select().from(budgets)
    .where(and(eq(budgets.householdId, hid), eq(budgets.month, DEFAULT_MONTH)))
    .all()

  const catMap = new Map(catRows.map(c => [c.id, c]))
  const acctMap = new Map(acctRows.map(a => [a.id, a]))

  const totalIncomeCents = txRows.filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0)
  const totalExpenseCents = Math.abs(txRows.filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0))
  const balanceCents = totalIncomeCents - totalExpenseCents
  const savingsRatePct = totalIncomeCents > 0 ? Math.round((balanceCents / totalIncomeCents) * 100) : 0

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

  const cashFlow: DashboardData["cashFlow"] = []
  const [yr, mo] = DEFAULT_MONTH.split("-").map(Number)
  for (let i = 5; i >= 0; i--) {
    let m = mo - i
    let y = yr
    while (m <= 0) { m += 12; y-- }
    const mStr = `${y}-${String(m).padStart(2, "0")}`
    const monthTx = db.select().from(transactions)
      .where(and(eq(transactions.householdId, hid), like(transactions.date, `${mStr}%`)))
      .all()
    cashFlow.push({
      month: mStr,
      incomeCents: monthTx.filter(t => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0),
      expenseCents: Math.abs(monthTx.filter(t => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0)),
    })
  }

  const lastTransactions = db.select().from(transactions)
    .where(and(eq(transactions.householdId, hid), like(transactions.date, `${DEFAULT_MONTH}%`)))
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

  const initialData: DashboardData = {
    month: DEFAULT_MONTH,
    totalIncomeCents,
    totalExpenseCents,
    balanceCents,
    savingsRatePct,
    byCategory,
    cashFlow,
    lastTransactions,
    budgetSummary,
  }

  return <DashboardClient initialData={initialData} />
}
