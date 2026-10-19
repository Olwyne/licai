import { db } from "@/lib/db"
import { budgets, categories, transactions } from "@/db/schema"
import { and, eq, gte } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"
import { suggestBudgets } from "@/lib/finance/budget-suggest"

// GET ?month=YYYY-MM : plafonds suggérés d'après les 6 derniers mois complets de dépenses, avec le plafond actuel du mois.
export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const today = new Date().toISOString().slice(0, 10)
  const month = new URL(req.url).searchParams.get("month") ?? today.slice(0, 7)
  const since = new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1).toISOString().slice(0, 10)
  const tx = db.select().from(transactions).where(and(eq(transactions.householdId, householdId), gte(transactions.date, since))).all()
    .filter((t) => t.kind === "expense")
  const cats = new Map(db.select().from(categories).where(eq(categories.householdId, householdId)).all().map((c) => [c.id, c]))
  const current = new Map(db.select().from(budgets).where(and(eq(budgets.householdId, householdId), eq(budgets.month, month))).all().map((b) => [b.categoryId, b.limitCents / 100]))
  const items = suggestBudgets(tx.map((t) => ({ categoryId: t.categoryId, amountCents: t.amountCents, date: t.date })), today).flatMap((s) => {
    const c = cats.get(s.categoryId)
    return c ? [{ ...s, label: c.label, icon: c.icon, colorHex: c.colorHex, current: current.get(s.categoryId) ?? null }] : []
  })
  return ok({ month, items })
}
