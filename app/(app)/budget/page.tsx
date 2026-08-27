import { db } from "@/lib/db"
import { budgets, transactions, categories } from "@/db/schema"
import { eq, and, like } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { BudgetClient } from "@/components/features/budget/BudgetClient"
import type { Category } from "@/db/schema"

export type EnrichedBudget = {
  id: string
  householdId: string
  categoryId: string
  limitCents: number
  month: string
  spentCents: number
  category: Category | null
}

export default async function BudgetPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId
  const month = new Date().toISOString().slice(0, 7)

  const budgetRows = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.householdId, hid), eq(budgets.month, month)))
    .all()

  const categoryRows = db
    .select()
    .from(categories)
    .where(eq(categories.householdId, hid))
    .all()

  const txRows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.householdId, hid), like(transactions.date, `${month}%`)))
    .all()

  const spentByCat: Record<string, number> = {}
  for (const tx of txRows) {
    if (tx.categoryId && tx.amountCents < 0) {
      spentByCat[tx.categoryId] =
        (spentByCat[tx.categoryId] ?? 0) + Math.abs(tx.amountCents)
    }
  }

  const enriched: EnrichedBudget[] = budgetRows.map((b) => ({
    ...b,
    spentCents: spentByCat[b.categoryId] ?? 0,
    category: categoryRows.find((c) => c.id === b.categoryId) ?? null,
  }))

  return (
    <BudgetClient month={month} budgets={enriched} categories={categoryRows} />
  )
}
