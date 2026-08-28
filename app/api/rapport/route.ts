import { db } from "@/lib/db"
import {
  transactions,
  budgets,
  members,
  accounts,
  recurring,
  categories,
  households,
} from "@/db/schema"
import { eq, and, like, or } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"
import { NextResponse } from "next/server"

function nextMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  return `${ny}-${String(nm).padStart(2, "0")}`
}

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month")
  const month = monthParam ?? new Date().toISOString().slice(0, 7)
  const nextMonth = nextMonthStr(month)

  try {
    // Household name
    const householdRow = db
      .select({ name: households.name })
      .from(households)
      .where(eq(households.id, householdId))
      .get()

    // Categories (for joining)
    const catRows = db
      .select()
      .from(categories)
      .where(eq(categories.householdId, householdId))
      .all()
    const catMap = new Map(catRows.map((c) => [c.id, c]))

    // Transactions for month
    const txRows = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          like(transactions.date, `${month}%`)
        )
      )
      .all()

    const txWithCategory = txRows.map((tx) => ({
      ...tx,
      categoryLabel: tx.categoryId ? (catMap.get(tx.categoryId)?.label ?? "") : "",
      categoryColor: tx.categoryId ? (catMap.get(tx.categoryId)?.colorHex ?? "") : "",
      categoryIcon: tx.categoryId ? (catMap.get(tx.categoryId)?.icon ?? "") : "",
    }))

    // Budgets for month
    const budgetRows = db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.householdId, householdId),
          eq(budgets.month, month)
        )
      )
      .all()

    // Compute spent per category from transactions
    const spentByCat = new Map<string, number>()
    for (const tx of txRows) {
      if (tx.categoryId && tx.amountCents < 0) {
        spentByCat.set(tx.categoryId, (spentByCat.get(tx.categoryId) ?? 0) + Math.abs(tx.amountCents))
      }
    }

    const budgetsWithSpent = budgetRows.map((b) => ({
      ...b,
      categoryLabel: catMap.get(b.categoryId)?.label ?? "",
      categoryColor: catMap.get(b.categoryId)?.colorHex ?? "",
      categoryIcon: catMap.get(b.categoryId)?.icon ?? "",
      spentCents: spentByCat.get(b.categoryId) ?? 0,
    }))

    // Members
    const memberRows = db
      .select()
      .from(members)
      .where(eq(members.householdId, householdId))
      .all()

    // Accounts
    const accountRows = db
      .select()
      .from(accounts)
      .where(eq(accounts.householdId, householdId))
      .all()

    // Recurring: upcoming in current or next month
    const recurringRows = db
      .select()
      .from(recurring)
      .where(
        and(
          eq(recurring.householdId, householdId),
          or(
            like(recurring.nextDate, `${month}%`),
            like(recurring.nextDate, `${nextMonth}%`)
          )
        )
      )
      .all()

    // KPIs
    const totalIncomeCents = txRows
      .filter((t) => t.amountCents > 0)
      .reduce((s, t) => s + t.amountCents, 0)
    const totalExpensesCents = txRows
      .filter((t) => t.amountCents < 0)
      .reduce((s, t) => s + Math.abs(t.amountCents), 0)
    const balanceCents = totalIncomeCents - totalExpensesCents
    const savingsRate =
      totalIncomeCents > 0 ? (balanceCents / totalIncomeCents) * 100 : 0

    // Expenses by category
    const expByCatMap = new Map<string, { categoryId: string; categoryLabel: string; categoryColor: string; categoryIcon: string; amountCents: number }>()
    for (const tx of txRows) {
      if (tx.amountCents < 0) {
        const key = tx.categoryId ?? "__none__"
        const existing = expByCatMap.get(key)
        if (existing) {
          existing.amountCents += Math.abs(tx.amountCents)
        } else {
          expByCatMap.set(key, {
            categoryId: key,
            categoryLabel: tx.categoryId ? (catMap.get(tx.categoryId)?.label ?? "Sans catégorie") : "Sans catégorie",
            categoryColor: tx.categoryId ? (catMap.get(tx.categoryId)?.colorHex ?? "") : "",
            categoryIcon: tx.categoryId ? (catMap.get(tx.categoryId)?.icon ?? "") : "",
            amountCents: Math.abs(tx.amountCents),
          })
        }
      }
    }
    const expensesByCategory = Array.from(expByCatMap.values()).sort(
      (a, b) => b.amountCents - a.amountCents
    )

    return ok({
      month,
      household: { name: householdRow?.name ?? null },
      members: memberRows,
      accounts: accountRows,
      transactions: txWithCategory,
      budgets: budgetsWithSpent,
      expensesByCategory,
      recurring: recurringRows,
      kpis: {
        totalIncomeCents,
        totalExpensesCents,
        balanceCents,
        savingsRate,
      },
    })
  } catch (e) {
    console.error("[rapport]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
