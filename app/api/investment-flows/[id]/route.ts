import { db } from "@/lib/db"
import { investmentFlows } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  db.delete(investmentFlows).where(and(eq(investmentFlows.id, id), eq(investmentFlows.householdId, householdId))).run()
  return ok({ id })
}
