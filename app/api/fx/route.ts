import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { mergeFx } from "@/lib/finance/fx"

// PUT /api/fx — enregistre les taux de change du foyer ({ rates, source, ts })
export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const body = (await req.json()) as { rates?: Record<string, unknown>; source?: string; ts?: string }
    const rates = mergeFx(body.rates)
    const source = ["demo", "manual", "api"].includes(body.source ?? "") ? body.source! : "demo"
    const ts = typeof body.ts === "string" ? body.ts.slice(0, 80) : ""
    db.update(households).set({ fxRates: JSON.stringify(rates), fxSource: source, fxTs: ts }).where(eq(households.id, householdId)).run()
    return ok({ rates, source, ts })
  } catch {
    return err("Erreur lors de l'enregistrement.", 500)
  }
}
