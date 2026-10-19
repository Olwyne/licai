import { getHouseholdId, ok, unauthorized } from "@/lib/api"
import { keyHint, resolveAi } from "@/lib/server/ai-key"
import { effectiveModel } from "@/lib/server/ai-client"
import { PROVIDERS } from "@/lib/server/ai-providers"

// L'assistant n'est disponible que si une clé API est fournie : celle du compte (Paramètres) ou celle du serveur.
// `model` = modèle effectivement utilisé (choix manuel, sinon sélection automatique), `auto` = choisi automatiquement.
export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const ai = resolveAi(householdId)
  const resolveModel = new URL(req.url).searchParams.get("model") === "1" && ai.key
  return ok({
    builtin: Boolean(ai.key),
    source: ai.source,
    hint: ai.source === "account" ? keyHint(ai.key) : "",
    provider: ai.provider,
    providerLabel: PROVIDERS[ai.provider].label,
    chosenModel: ai.model,
    model: resolveModel ? await effectiveModel(ai.provider, ai.key!, ai.model) : ai.model || null,
  })
}
