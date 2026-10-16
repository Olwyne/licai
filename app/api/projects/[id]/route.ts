import { db } from "@/lib/db"
import { projects } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const { id } = await params
  const body = await req.json()

  const allowed = ["name", "emoji", "description", "deadline", "colorHex"]
  const updates: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }

  if (Object.keys(updates).length === 0) return err("Nothing to update")

  db.update(projects)
    .set(updates)
    .where(and(eq(projects.id, id), eq(projects.householdId, householdId)))
    .run()

  const updated = db.select().from(projects).where(and(eq(projects.id, id), eq(projects.householdId, householdId))).get()
  if (!updated) return err("Not found", 404)
  return ok(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const { id } = await params
  db.delete(projects).where(and(eq(projects.id, id), eq(projects.householdId, householdId))).run()
  return ok({ ok: true })
}
