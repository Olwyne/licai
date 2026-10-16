import { db } from "@/lib/db"
import { properties, propertyOwners } from "@/db/schema"
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
      address?: string
      surfaceSqm?: number | null
      lots?: string
      taxeFonciereCents?: number
      taxeFonciereHistory?: string
      lastEstimatedAt?: string | null
      residenceType?: string
      rentMonthlyCents?: number
      estimateSource?: string
      costs?: Record<string, number>
      owners?: { memberId: string; sharePercent: number }[]
    }

    const patch: Partial<typeof row> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.valueCents !== undefined) patch.valueCents = body.valueCents
    if (body.purchasePriceCents !== undefined) patch.purchasePriceCents = body.purchasePriceCents
    if (body.purchaseDate !== undefined) patch.purchaseDate = body.purchaseDate
    if (body.note !== undefined) patch.note = body.note
    if (body.address !== undefined) patch.address = body.address
    if (body.surfaceSqm !== undefined) patch.surfaceSqm = body.surfaceSqm
    if (body.lots !== undefined) patch.lots = body.lots
    if (body.taxeFonciereCents !== undefined) patch.taxeFonciereCents = body.taxeFonciereCents
    if (body.taxeFonciereHistory !== undefined) patch.taxeFonciereHistory = body.taxeFonciereHistory
    if (body.lastEstimatedAt !== undefined) patch.lastEstimatedAt = body.lastEstimatedAt
    if (body.residenceType !== undefined) patch.residenceType = body.residenceType
    if (body.rentMonthlyCents !== undefined) patch.rentMonthlyCents = body.rentMonthlyCents
    if (body.estimateSource !== undefined) patch.estimateSource = body.estimateSource
    if (body.costs !== undefined) patch.costs = JSON.stringify(body.costs)

    db.update(properties).set(patch).where(and(eq(properties.id, id), eq(properties.householdId, householdId))).run()

    if (body.owners !== undefined) {
      db.delete(propertyOwners).where(eq(propertyOwners.propertyId, id)).run()
      for (const o of body.owners) {
        db.insert(propertyOwners).values({
          id: randomUUID(),
          propertyId: id,
          memberId: o.memberId,
          sharePercent: o.sharePercent,
        }).run()
      }
    }

    const updated = db.select().from(properties).where(and(eq(properties.id, id), eq(properties.householdId, householdId))).get()
    const owners = db.select().from(propertyOwners).where(eq(propertyOwners.propertyId, id)).all()
    return ok({ ...updated, owners })
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
    db.delete(propertyOwners).where(eq(propertyOwners.propertyId, id)).run()
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
