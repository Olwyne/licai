import { db } from "@/lib/db"
import { categories } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  const body = (await req.json()) as { label?: string; icon?: string; colorHex?: string }
  const patch: Partial<typeof categories.$inferInsert> = {}
  if (body.label?.trim()) patch.label = body.label.trim()
  if (body.icon?.trim()) patch.icon = body.icon.trim()
  if (body.colorHex?.trim()) patch.colorHex = body.colorHex.trim()
  if (Object.keys(patch).length === 0) return err("Nothing to update")
  db.update(categories).set(patch).where(and(eq(categories.id, id), eq(categories.householdId, householdId))).run()
  const row = db.select().from(categories).where(and(eq(categories.id, id), eq(categories.householdId, householdId))).get()
  if (!row) return err("Not found", 404)
  return ok(row)
}
