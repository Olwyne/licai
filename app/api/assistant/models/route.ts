import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { resolveAi } from "@/lib/server/ai-key"
import { effectiveModel, listModels } from "@/lib/server/ai-client"
import { pickModel } from "@/lib/server/ai-providers"

// Modèles accessibles avec la clé configurée + modèle recommandé automatiquement.
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const ai = resolveAi(householdId)
  if (!ai.key) return err("Aucune clé API configurée.", 404)
  try {
    const models = await listModels(ai.provider, ai.key)
    return ok({ provider: ai.provider, recommended: pickModel(ai.provider, models), models: models.map((m) => m.id).sort() })
  } catch {
    return ok({ provider: ai.provider, recommended: await effectiveModel(ai.provider, ai.key, ""), models: [] })
  }
}
