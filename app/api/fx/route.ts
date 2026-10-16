import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { FIAT_CODES, mergeFx } from "@/lib/finance/fx"

// PUT /api/fx — enregistre les taux de change du foyer ({ rates, source, ts, currency? }).
// Les taux sont exprimés dans la devise de référence ; changer `currency` ramène les taux existants à la nouvelle
// devise (les montants saisis ne sont PAS convertis).
export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const body = (await req.json()) as { rates?: Record<string, unknown>; source?: string; ts?: string; currency?: string }
    const hh = db.select().from(households).where(eq(households.id, householdId)).get()
    if (!hh) return err("Foyer introuvable", 404)
    let currency = hh.currency
    let stored: unknown = body.rates
    if (body.currency && body.currency !== currency) {
      if (!FIAT_CODES.includes(body.currency)) return err("Devise de référence invalide", 400)
      let old: unknown = {}
      try { old = JSON.parse(hh.fxRates) } catch { /* taux par défaut */ }
      // anciens taux (en `currency`) ramenés à la nouvelle devise de référence
      const oldFull = mergeFx(old, currency)
      const d = oldFull[body.currency] || 1
      stored = body.rates ?? Object.fromEntries(Object.entries(oldFull).map(([k, v]) => [k, v / d]))
      currency = body.currency
    }
    const rates = mergeFx(stored, currency)
    const source = ["demo", "manual", "api"].includes(body.source ?? "") ? body.source! : hh.fxSource
    const ts = typeof body.ts === "string" ? body.ts.slice(0, 80) : hh.fxTs
    db.update(households).set({ fxRates: JSON.stringify(rates), fxSource: source, fxTs: ts, currency }).where(eq(households.id, householdId)).run()
    return ok({ rates, source, ts, currency })
  } catch {
    return err("Erreur lors de l'enregistrement.", 500)
  }
}
