import { db } from "@/lib/db"
import { investments } from "@/db/schema"
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
      .from(investments)
      .where(and(eq(investments.id, id), eq(investments.householdId, householdId)))
      .get()
    if (!row) return err("Not found", 404)

    const body = (await req.json()) as {
      name?: string
      ticker?: string
      kind?: string
      quantity?: number
      unitPriceCents?: number
      purchasePriceCents?: number
      note?: string
      accountId?: string | null
      assetClass?: string
      zone?: string
      sector?: string
      currency?: string
      cap?: string
      terPct?: number
      gainCents?: number | null
      prevPriceCents?: number | null
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.ticker !== undefined) patch.ticker = body.ticker
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.quantity !== undefined) patch.quantity = body.quantity
    if (body.unitPriceCents !== undefined) patch.unitPriceCents = body.unitPriceCents
    if (body.purchasePriceCents !== undefined) patch.purchasePriceCents = body.purchasePriceCents
    if (body.note !== undefined) patch.note = body.note
    if (body.accountId !== undefined) patch.accountId = body.accountId
    if (body.assetClass !== undefined) patch.assetClass = body.assetClass
    if (body.zone !== undefined) patch.zone = body.zone
    if (body.sector !== undefined) patch.sector = body.sector
    if (body.currency !== undefined) patch.currency = body.currency
    if (body.cap !== undefined) patch.cap = body.cap
    if (body.terPct !== undefined) patch.terPct = body.terPct
    if (body.gainCents !== undefined) patch.gainCents = body.gainCents
    if (body.prevPriceCents !== undefined) patch.prevPriceCents = body.prevPriceCents

    db.update(investments)
      .set(patch)
      .where(and(eq(investments.id, id), eq(investments.householdId, householdId)))
      .run()

    const updated = db
      .select()
      .from(investments)
      .where(and(eq(investments.id, id), eq(investments.householdId, householdId)))
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
      .delete(investments)
      .where(and(eq(investments.id, id), eq(investments.householdId, householdId)))
      .run()

    if (result.changes === 0) return err("Not found", 404)
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
