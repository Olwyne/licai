import { db } from "@/lib/db"
import { alertStates } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

// PUT /api/alerts/state — { id, status: "done" | "snooze" | null } (null = rouvrir)
export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const { id, status } = (await req.json()) as { id?: string; status?: string | null }
    if (!id || typeof id !== "string" || id.length > 120) return err("id requis", 400)
    const where = and(eq(alertStates.householdId, householdId), eq(alertStates.alertId, id))
    db.delete(alertStates).where(where).run()
    if (status === "done" || status === "snooze") db.insert(alertStates).values({ householdId, alertId: id, status }).run()
    return ok({ id, status: status ?? null })
  } catch {
    return err("Erreur lors de l'enregistrement.", 500)
  }
}
