import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { encryptSecret, decryptSecret } from "@/lib/server/secret"
import { AiHttpError, listModels } from "@/lib/server/ai-client"
import { PROVIDERS, isAuthFailure, isProvider } from "@/lib/server/ai-providers"

// GET : révèle la clé enregistrée du compte (bouton « afficher » des paramètres).
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const hh = db.select({ k: households.aiKeyEnc }).from(households).where(eq(households.id, householdId)).get()
  const key = hh?.k ? decryptSecret(hh.k) : ""
  if (hh?.k && key === null) return err("La clé enregistrée est illisible (le secret du serveur a changé) : saisissez-la à nouveau.", 409)
  return ok({ key: key ?? "" })
}

// PUT { provider, model?, key? } : enregistre le fournisseur, le modèle (vide = automatique) et, si fournie, la clé (vide = supprime).
// La clé est vérifiée auprès du fournisseur ; si celui-ci est injoignable, elle est enregistrée avec un avertissement.
export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const body = (await req.json()) as { provider?: unknown; model?: unknown; key?: unknown }
    const current = db.select({ p: households.aiProvider, k: households.aiKeyEnc }).from(households).where(eq(households.id, householdId)).get()
    const provider = isProvider(body.provider) ? body.provider : isProvider(current?.p) ? current.p : "anthropic"
    const model = typeof body.model === "string" ? body.model.trim().slice(0, 120) : ""
    if (/\s/.test(model)) return err("Nom de modèle invalide.", 400)

    const patch: { aiProvider: string; aiModel: string; aiKeyEnc?: string } = { aiProvider: provider, aiModel: model }
    let warning = ""
    if (typeof body.key === "string") {
      const key = body.key.trim()
      if (key) {
        if (key.length < 20 || key.length > 400 || /\s/.test(key)) return err("Clé API invalide.", 400)
        // AI_SKIP_KEY_CHECK=1 : pas de vérification réseau (tests automatisés).
        if (process.env.AI_SKIP_KEY_CHECK !== "1") try { await listModels(provider, key) } catch (e) {
          if (e instanceof AiHttpError && isAuthFailure(e.status)) return err(`Clé refusée par ${PROVIDERS[provider].label}.`, 400)
          warning = `${PROVIDERS[provider].label} est injoignable : la clé n'a pas pu être vérifiée.`
        }
        patch.aiKeyEnc = encryptSecret(key)
      } else patch.aiKeyEnc = ""
    }
    db.update(households).set(patch).where(eq(households.id, householdId)).run()
    return ok({ saved: true, warning })
  } catch {
    return err("Erreur lors de l'enregistrement.", 500)
  }
}
