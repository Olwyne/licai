import { db } from "@/lib/db"
import { properties } from "@/db/schema"
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
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.householdId, householdId)))
      .get()
    if (!row) return err("Not found", 404)

    const body = (await req.json()) as {
      name?: string
      kind?: string
      valueCents?: number
      purchasePriceCents?: number
      purchaseDate?: string | null
      note?: string
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.valueCents !== undefined) patch.valueCents = body.valueCents
    if (body.purchasePriceCents !== undefined) patch.purchasePriceCents = body.purchasePriceCents
    if (body.purchaseDate !== undefined) patch.purchaseDate = body.purchaseDate
    if (body.note !== undefined) patch.note = body.note

    db.update(properties).set(patch).where(and(eq(properties.id, id), eq(properties.householdId, householdId))).run()

    const updated = db.select().from(properties).where(and(eq(properties.id, id), eq(properties.householdId, householdId))).get()
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
      .delete(properties)
      .where(and(eq(properties.id, id), eq(properties.householdId, householdId)))
      .run()
    if (result.changes === 0) return err("Not found", 404)
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
