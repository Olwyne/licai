import { db } from "@/lib/db"
import { investmentAccounts, investments } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import type { AccountBody } from "../route"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  try {
    const row = db.select().from(investmentAccounts)
      .where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.householdId, householdId))).get()
    if (!row) return err("Not found", 404)
    const b = (await req.json()) as AccountBody
    const patch: Partial<typeof row> = {}
    if (b.name !== undefined) patch.name = b.name.trim()
    if (b.kind !== undefined) patch.kind = b.kind
    if (b.bank !== undefined) patch.bank = b.bank
    if (b.ownerIds !== undefined) patch.ownerIds = JSON.stringify(b.ownerIds)
    if (b.benefIds !== undefined) patch.benefIds = JSON.stringify(b.benefIds)
    if (b.sinceYear !== undefined) patch.sinceYear = b.sinceYear
    if (b.paidCents !== undefined) patch.paidCents = b.paidCents
    if (b.monthlyCents !== undefined) patch.monthlyCents = b.monthlyCents
    if (b.feesPct !== undefined) patch.feesPct = b.feesPct
    if (b.matchPct !== undefined) patch.matchPct = b.matchPct
    db.update(investmentAccounts).set(patch)
      .where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.householdId, householdId))).run()
    return ok({ id })
  } catch {
    return err("Erreur lors de la mise à jour.", 500)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  try {
    db.update(investments).set({ accountId: null })
      .where(and(eq(investments.accountId, id), eq(investments.householdId, householdId))).run()
    db.delete(investmentAccounts)
      .where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.householdId, householdId))).run()
    return ok({ id })
  } catch {
    return err("Erreur lors de la suppression.", 500)
  }
}
