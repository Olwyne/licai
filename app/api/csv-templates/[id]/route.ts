import { db } from "@/lib/db"
import { csvTemplates } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  const r = db.delete(csvTemplates).where(and(eq(csvTemplates.id, id), eq(csvTemplates.householdId, householdId))).run()
  return r.changes ? ok({ deleted: true }) : err("Modèle introuvable", 404)
}
