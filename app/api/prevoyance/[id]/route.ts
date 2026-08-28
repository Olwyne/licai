import { db } from "@/lib/db"
import { contracts } from "@/db/schema"
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
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.householdId, householdId)))
      .get()
    if (!row) return err("Not found", 404)

    const body = (await req.json()) as {
      name?: string
      insurer?: string
      kind?: string
      valueCents?: number
      monthlyPremiumCents?: number
      startDate?: string | null
      endDate?: string | null
      note?: string
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.insurer !== undefined) patch.insurer = body.insurer
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.valueCents !== undefined) patch.valueCents = body.valueCents
    if (body.monthlyPremiumCents !== undefined) patch.monthlyPremiumCents = body.monthlyPremiumCents
    if (body.startDate !== undefined) patch.startDate = body.startDate
    if (body.endDate !== undefined) patch.endDate = body.endDate
    if (body.note !== undefined) patch.note = body.note

    db.update(contracts)
      .set(patch)
      .where(and(eq(contracts.id, id), eq(contracts.householdId, householdId)))
      .run()

    const updated = db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.householdId, householdId)))
      .get()

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
      .delete(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.householdId, householdId)))
      .run()

    if (result.changes === 0) return err("Not found", 404)
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
