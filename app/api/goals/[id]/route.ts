import { db } from "@/lib/db"
import { goals, goalPockets } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  try {
    const row = db.select().from(goals).where(and(eq(goals.id, id), eq(goals.householdId, householdId))).get()
    if (!row) return err("Not found", 404)

    const body = (await req.json()) as {
      name?: string
      emoji?: string
      description?: string
      targetCents?: number
      currentCents?: number
      deadline?: string | null
      kind?: string
      colorHex?: string
      linkedAccountId?: string | null
      memberId?: string | null
      monthlyCents?: number | null
      risk?: string
      ownerIds?: string[]
      pockets?: { accountId: string; pct: number }[]
      resolved?: boolean
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined)            patch.name = body.name.trim()
    if (body.emoji !== undefined)           patch.emoji = body.emoji
    if (body.description !== undefined)     patch.description = body.description
    if (body.targetCents !== undefined)     patch.targetCents = body.targetCents
    if (body.currentCents !== undefined)    patch.currentCents = body.currentCents
    if (body.deadline !== undefined)        patch.deadline = body.deadline
    if (body.kind !== undefined)            patch.kind = body.kind
    if (body.colorHex !== undefined)        patch.colorHex = body.colorHex
    if (body.linkedAccountId !== undefined) patch.linkedAccountId = body.linkedAccountId
    if (body.memberId !== undefined)        patch.memberId = body.memberId
    if (body.monthlyCents !== undefined)    patch.monthlyCents = body.monthlyCents
    if (body.risk !== undefined)            patch.risk = body.risk
    if (body.ownerIds !== undefined)        patch.ownerIds = JSON.stringify(body.ownerIds)

    if (Object.keys(patch).length > 0) {
      db.update(goals).set(patch).where(and(eq(goals.id, id), eq(goals.householdId, householdId))).run()
    }

    if (body.pockets !== undefined) {
      db.delete(goalPockets).where(eq(goalPockets.goalId, id)).run()
      for (const p of body.pockets) {
        db.insert(goalPockets).values({ id: randomUUID(), goalId: id, accountId: p.accountId, pct: p.pct }).run()
      }
    }

    const updated = db.select().from(goals).where(eq(goals.id, id)).get()
    const pockets = db.select().from(goalPockets).where(eq(goalPockets.goalId, id)).all()
    return ok({ ...updated, pockets })
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
    const row = db.select().from(goals).where(and(eq(goals.id, id), eq(goals.householdId, householdId))).get()
    if (!row) return err("Not found", 404)

    db.delete(goalPockets).where(eq(goalPockets.goalId, id)).run()
    db.delete(goals).where(and(eq(goals.id, id), eq(goals.householdId, householdId))).run()
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
