import { db } from "@/lib/db"
import { loans } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  try {
    const body = (await req.json()) as Partial<{
      name: string
      kind: string
      principalCents: number
      remainingCents: number
      monthlyPaymentCents: number
      ratePercent: number
      endDate: string | null
      note: string
      propertyId: string | null
      startDate: string | null
      accountId: string | null
      ownerIds: string[]
      insuranceCents: number
    }>

    const update: Record<string, unknown> = {}
    if (body.name !== undefined) update.name = body.name.trim()
    if (body.kind !== undefined) update.kind = body.kind
    if (body.principalCents !== undefined) update.principalCents = body.principalCents
    if (body.remainingCents !== undefined) update.remainingCents = body.remainingCents
    if (body.monthlyPaymentCents !== undefined) update.monthlyPaymentCents = body.monthlyPaymentCents
    if (body.ratePercent !== undefined) update.ratePercent = body.ratePercent
    if (body.endDate !== undefined) update.endDate = body.endDate
    if (body.note !== undefined) update.note = body.note
    if (body.propertyId !== undefined) update.propertyId = body.propertyId
    if (body.startDate !== undefined) update.startDate = body.startDate
    if (body.accountId !== undefined) update.accountId = body.accountId
    if (body.ownerIds !== undefined) update.ownerIds = JSON.stringify(body.ownerIds)
    if (body.insuranceCents !== undefined) update.insuranceCents = body.insuranceCents

    db.update(loans).set(update).where(and(eq(loans.id, id), eq(loans.householdId, householdId))).run()
    const row = db.select().from(loans).where(and(eq(loans.id, id), eq(loans.householdId, householdId))).get()
    if (!row) return err("Crédit introuvable.", 404)
    return ok(row)
  } catch {
    return err("Erreur lors de la mise à jour.", 500)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  try {
    db.delete(loans).where(and(eq(loans.id, id), eq(loans.householdId, householdId))).run()
    return ok({ deleted: true })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
