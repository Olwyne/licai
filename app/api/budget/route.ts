import { db } from "@/lib/db"
import { budgets, transactions, categories } from "@/db/schema"
import { eq, and, like } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const month =
    new URL(req.url).searchParams.get("month") ??
    new Date().toISOString().slice(0, 7)

  const budgetRows = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.householdId, householdId), eq(budgets.month, month)))
    .all()

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

  const spentByCat: Record<string, number> = {}
  for (const tx of txRows) {
    if (tx.categoryId && tx.amountCents < 0) {
      spentByCat[tx.categoryId] =
        (spentByCat[tx.categoryId] ?? 0) + Math.abs(tx.amountCents)
    }
  }

  const catRows = db
    .select()
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .all()

  const result = budgetRows.map((b) => ({
    ...b,
    spentCents: spentByCat[b.categoryId] ?? 0,
    category: catRows.find((c) => c.id === b.categoryId) ?? null,
  }))

  return ok(result)
}

export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const body = (await req.json()) as {
    month?: string
    items?: { categoryId: string; limitCents: number }[]
  }
  const { month, items } = body
  if (!month || !Array.isArray(items)) return err("month and items required")

  for (const item of items) {
    const existing = db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.householdId, householdId),
          eq(budgets.month, month),
          eq(budgets.categoryId, item.categoryId)
        )
      )
      .get()
    if (existing) {
      db.update(budgets)
        .set({ limitCents: item.limitCents })
        .where(eq(budgets.id, existing.id))
        .run()
    } else {
      db.insert(budgets)
        .values({
          id: randomUUID(),
          householdId,
          month,
          categoryId: item.categoryId,
          limitCents: item.limitCents,
        })
        .run()
    }
  }

  revalidateTag("budget", { expire: 0 })
  return ok(
    db
      .select()
      .from(budgets)
      .where(
        and(eq(budgets.householdId, householdId), eq(budgets.month, month))
      )
      .all()
  )
}

// DELETE /api/budget?month=YYYY-MM&categoryId=… — retire une catégorie du budget du mois
export async function DELETE(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const q = new URL(req.url).searchParams
  const month = q.get("month"), categoryId = q.get("categoryId")
  if (!month || !categoryId) return err("month and categoryId required")
  db.delete(budgets)
    .where(and(eq(budgets.householdId, householdId), eq(budgets.month, month), eq(budgets.categoryId, categoryId)))
    .run()
  revalidateTag("budget", { expire: 0 })
  return ok({ deleted: true })
}
