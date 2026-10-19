import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { mergeFx } from "@/lib/finance/fx"
import { fetchMarketRates, nowLabel } from "@/lib/server/market-fetch"

// GET /api/market/fx — taux du jour, exprimés dans la devise de référence du foyer. Ne modifie rien :
// le client enregistre ensuite les taux via PUT /api/fx.
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  if (!hh) return err("Foyer introuvable", 404)
  let stored: unknown = {}
  try { stored = JSON.parse(hh.fxRates) } catch { /* taux par défaut */ }
  const { rates, failed } = await fetchMarketRates(hh.currency, mergeFx(stored, hh.currency))
  if (failed.length === 2) return err("Fournisseurs de taux injoignables.", 502)
  return ok({ rates, failed, ts: nowLabel() })
}
