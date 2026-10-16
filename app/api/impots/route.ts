import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { DEFAULT_SITUATION } from "@/lib/finance/tax"

const FIELDS = ["couple", "dependents", "youngKids", "fraisReels", "foncier", "chargesFoncieres", "travaux", "dons", "domicile", "garde", "autres", "dividendes", "interets"] as const

// PUT /api/impots — enregistre la situation fiscale du foyer ({} = valeurs par défaut)
export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const body = (await req.json()) as Record<string, unknown>
    const clean: Record<string, unknown> = {}
    for (const k of FIELDS) {
      if (!(k in body)) continue
      const def = DEFAULT_SITUATION[k]
      if (typeof def === "boolean") clean[k] = !!body[k]
      else if (k === "foncier") clean[k] = body[k] === "micro" ? "micro" : "reel"
      else {
        const n = Number(body[k])
        clean[k] = Number.isFinite(n) && n >= 0 ? n : 0
      }
    }
    db.update(households).set({ taxSituation: JSON.stringify(clean) }).where(eq(households.id, householdId)).run()
    return ok(clean)
  } catch {
    return err("Erreur lors de l'enregistrement.", 500)
  }
}
