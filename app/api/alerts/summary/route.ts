import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { buildAlertsData } from "@/lib/server/alerts-data"

// Nombre d'alertes ouvertes importantes (pastille de la barre latérale)
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const { items } = buildAlertsData(householdId)
    return ok({ count: items.filter((a) => a.status === "open" && (a.tone === "high" || a.tone === "mid")).length })
  } catch {
    return err("Erreur de base de données.", 500)
  }
}
