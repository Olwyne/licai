import { db } from "@/lib/db"
import { banks } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  const body = await req.json()
  const allowed = ["name", "colorHex", "csvSeparator", "csvDecimal", "csvDateFormat"]
  const updates: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }
  if (Object.keys(updates).length === 0) return err("Nothing to update")
  db.update(banks).set(updates).where(and(eq(banks.id, id), eq(banks.householdId, householdId))).run()
  const updated = db.select().from(banks).where(and(eq(banks.id, id), eq(banks.householdId, householdId))).get()
  if (!updated) return err("Not found", 404)
  return ok(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  db.delete(banks).where(and(eq(banks.id, id), eq(banks.householdId, householdId))).run()
  return ok({ ok: true })
}
