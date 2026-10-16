import { db } from "@/lib/db"
import { loans } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  try {
    const row = db
      .select()
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.householdId, householdId)))
      .get()
    if (!row) return err("Not found", 404)

    const body = (await req.json()) as {
      name?: string
      kind?: string
      principalCents?: number
      remainingCents?: number
      monthlyPaymentCents?: number
      ratePercent?: number
      endDate?: string | null
      note?: string
      propertyId?: string | null
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.principalCents !== undefined) patch.principalCents = body.principalCents
    if (body.remainingCents !== undefined) patch.remainingCents = body.remainingCents
    if (body.monthlyPaymentCents !== undefined) patch.monthlyPaymentCents = body.monthlyPaymentCents
    if (body.ratePercent !== undefined) patch.ratePercent = body.ratePercent
    if (body.endDate !== undefined) patch.endDate = body.endDate
    if (body.note !== undefined) patch.note = body.note
    if (body.propertyId !== undefined) patch.propertyId = body.propertyId

    db.update(loans).set(patch).where(and(eq(loans.id, id), eq(loans.householdId, householdId))).run()

    const updated = db.select().from(loans).where(and(eq(loans.id, id), eq(loans.householdId, householdId))).get()
    return ok(updated)
  } catch {
    return err("Erreur lors de la mise à jour.", 500)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  try {
    const result = db
      .delete(loans)
      .where(and(eq(loans.id, id), eq(loans.householdId, householdId)))
      .run()
    if (result.changes === 0) return err("Not found", 404)
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
