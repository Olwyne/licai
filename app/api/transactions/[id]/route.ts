import { db } from "@/lib/db"
import { transactions } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { revalidateTag } from "next/cache"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const { id } = await params
  const body = await req.json()

  const allowed = ["name", "amountCents", "date", "accountId", "categoryId", "note", "isCommon"]
  const updates: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }

  if (Object.keys(updates).length === 0) {
    return err("Nothing to update")
  }

  db.update(transactions)
    .set(updates)
    .where(and(eq(transactions.id, id), eq(transactions.householdId, householdId)))
    .run()

  revalidateTag("transactions", { expire: 0 })
  const updated = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .get()

  return ok(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const { id } = await params

  db.delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.householdId, householdId)))
    .run()

  revalidateTag("transactions", { expire: 0 })
  return ok({ ok: true })
}
