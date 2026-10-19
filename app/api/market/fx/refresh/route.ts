import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { mergeFx } from "@/lib/finance/fx"
import { fetchMarketRates, nowLabel } from "@/lib/server/market-fetch"
import { markUpdated, recordSnapshot } from "@/lib/server/fx-history"

export const STALE_AFTER_MS = 6 * 3600_000

// POST /api/market/fx/refresh — mise à jour automatique : si elle est activée pour le foyer et que les taux ont plus de 6 h,
// récupère les taux du jour (devises + crypto), les enregistre et ajoute le relevé du jour à l'historique.
export async function POST() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  if (!hh) return err("Foyer introuvable", 404)
  if (!hh.fxAuto) return ok({ refreshed: false, reason: "disabled" })
  if (hh.fxUpdatedAt && Date.now() - Date.parse(hh.fxUpdatedAt) < STALE_AFTER_MS) return ok({ refreshed: false, reason: "fresh" })

  let stored: unknown = {}
  try { stored = JSON.parse(hh.fxRates) } catch { /* taux par défaut */ }
  const { rates, failed } = await fetchMarketRates(hh.currency, mergeFx(stored, hh.currency))
  if (failed.length === 2) return ok({ refreshed: false, reason: "unreachable" })
  db.update(households).set({ fxRates: JSON.stringify(rates), fxSource: "api", fxTs: nowLabel() }).where(eq(households.id, householdId)).run()
  recordSnapshot(householdId, hh.currency, rates)
  markUpdated(householdId)
  return ok({ refreshed: true, failed })
}
