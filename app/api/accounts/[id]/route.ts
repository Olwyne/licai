import { householdFx } from "@/lib/server/fx-convert"
import { db } from "@/lib/db"
import { accounts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { revalidateTag } from "next/cache"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  const body = await req.json()
  const allowed = ["name", "type", "balanceCents", "currency", "bankId", "ownerIds", "colorHex", "iban", "last4", "purpose"]
  const updates: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) updates[k] = k === "ownerIds" ? JSON.stringify(body[k]) : body[k]
  }
  if (Object.keys(updates).length === 0) return err("Nothing to update")
  // changement de devise : le taux à l'ouverture repart du taux courant
  if (typeof updates.currency === "string") {
    const cur = db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId))).get()
    if (cur && cur.currency !== updates.currency) {
      const hf = householdFx(householdId)
      updates.openedRate = updates.currency === hf.base ? null : hf.fx[updates.currency] ?? null
    }
  }
  try {
    db.update(accounts).set(updates).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId))).run()
  } catch {
    return err("Constraint violation or database error", 400)
  }
  revalidateTag("accounts", { expire: 0 })
  const updated = db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId))).get()
  if (!updated) return err("Not found", 404)
  return ok(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  try {
    db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.householdId, householdId))).run()
  } catch {
    return err("Constraint violation or database error", 400)
  }
  revalidateTag("accounts", { expire: 0 })
  return ok({ ok: true })
}
