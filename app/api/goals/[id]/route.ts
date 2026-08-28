import { db } from "@/lib/db"
import { goals } from "@/db/schema"
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
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.householdId, householdId)))
      .get()
    if (!row) return err("Not found", 404)

    const body = (await req.json()) as {
      name?: string
      emoji?: string
      targetCents?: number
      currentCents?: number
      deadline?: string | null
      kind?: string
      colorHex?: string
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.emoji !== undefined) patch.emoji = body.emoji
    if (body.targetCents !== undefined) patch.targetCents = body.targetCents
    if (body.currentCents !== undefined) patch.currentCents = body.currentCents
    if (body.deadline !== undefined) patch.deadline = body.deadline
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.colorHex !== undefined) patch.colorHex = body.colorHex

    db.update(goals).set(patch).where(eq(goals.id, id)).run()

    const updated = db.select().from(goals).where(eq(goals.id, id)).get()
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
    const row = db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.householdId, householdId)))
      .get()
    if (!row) return err("Not found", 404)

    db.delete(goals).where(eq(goals.id, id)).run()
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
