import { db } from "@/lib/db"
import { alerts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { revalidateTag } from "next/cache"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params

  const row = db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, id), eq(alerts.householdId, householdId)))
    .get()
  if (!row) return err("Not found", 404)

  const body = (await req.json()) as { resolved?: boolean }
  const allowed: Partial<typeof row> = {}
  if (body.resolved !== undefined) allowed.resolved = body.resolved

  db.update(alerts).set(allowed).where(eq(alerts.id, id)).run()
  revalidateTag("alerts", { expire: 0 })
  return ok(db.select().from(alerts).where(eq(alerts.id, id)).get())
}
