import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { ASSISTANT_SYSTEM, buildAssistantSnapshot } from "@/lib/server/assistant-snapshot"

// Contexte transmis à un fournisseur externe configuré dans le navigateur (jamais envoyé avant le premier message).
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    return ok({ system: ASSISTANT_SYSTEM, snapshot: buildAssistantSnapshot(householdId) })
  } catch {
    return err("Erreur de base de données.", 500)
  }
}
