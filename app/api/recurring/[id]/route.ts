import { db } from "@/lib/db"
import { recurring } from "@/db/schema"
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

  const row = db
    .select()
    .from(recurring)
    .where(and(eq(recurring.id, id), eq(recurring.householdId, householdId)))
    .get()
  if (!row) return err("Not found", 404)

  const body = (await req.json()) as {
    name?: string
    amountCents?: number
    frequency?: "monthly" | "quarterly" | "annual"
    kind?: "charge" | "subscription" | "saving"
    nextDate?: string
    accountId?: string | null
    categoryId?: string | null
    active?: boolean
  }

  const allowed: Partial<typeof row> = {}
  if (body.name !== undefined) allowed.name = body.name
  if (body.amountCents !== undefined) allowed.amountCents = body.amountCents
  if (body.frequency !== undefined) allowed.frequency = body.frequency
  if (body.kind !== undefined) allowed.kind = body.kind
  if (body.nextDate !== undefined) allowed.nextDate = body.nextDate
  if (body.accountId !== undefined) allowed.accountId = body.accountId
  if (body.categoryId !== undefined) allowed.categoryId = body.categoryId
  if (body.active !== undefined) allowed.active = body.active

  db.update(recurring).set(allowed).where(eq(recurring.id, id)).run()
  revalidateTag("recurring", { expire: 0 })
  return ok(db.select().from(recurring).where(eq(recurring.id, id)).get())
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  const row = db
    .select()
    .from(recurring)
    .where(and(eq(recurring.id, id), eq(recurring.householdId, householdId)))
    .get()
  if (!row) return err("Not found", 404)

  try {
    db.delete(recurring).where(eq(recurring.id, id)).run()
  } catch {
    return err("Constraint violation or database error", 400)
  }
  revalidateTag("recurring", { expire: 0 })
  return ok({ ok: true })
}
