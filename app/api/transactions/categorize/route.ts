import { db } from "@/lib/db"
import { categories, transactions } from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { resolveAi } from "@/lib/server/ai-key"
import { AiHttpError, completeChat, effectiveModel } from "@/lib/server/ai-client"
import { categorizationPrompt, parseCategorization, suggestFromHistory, type CatSuggestion } from "@/lib/finance/categorize"
import { revalidateTag } from "next/cache"

const MAX_AI = 80 // transactions envoyées à l'IA par demande

// GET : transactions sans catégorie + suggestions (historique du foyer, puis IA si une clé est configurée). Ne modifie rien.
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const cats = db.select().from(categories).where(eq(categories.householdId, householdId)).all()
  const all = db.select().from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.kind, "expense"))).all()
  const uncategorized = all.filter((t) => !t.categoryId).map((t) => ({ id: t.id, name: t.name, categoryId: null, amountCents: t.amountCents, date: t.date }))
  const categorized = all.filter((t) => t.categoryId).map((t) => ({ id: t.id, name: t.name, categoryId: t.categoryId, amountCents: t.amountCents }))

  const suggestions: CatSuggestion[] = suggestFromHistory(uncategorized, categorized)
  const done = new Set(suggestions.map((s) => s.id))
  const rest = uncategorized.filter((t) => !done.has(t.id)).slice(0, MAX_AI)

  let ai: "unavailable" | "used" | "error" = "unavailable"
  let aiError = ""
  const cfg = resolveAi(householdId)
  if (rest.length && cfg.key) {
    try {
      const { system, user } = categorizationPrompt(cats.map((c) => ({ id: c.id, label: c.label })), rest)
      const model = await effectiveModel(cfg.provider, cfg.key, cfg.model)
      const text = await completeChat({ provider: cfg.provider, key: cfg.key, model, system, user })
      suggestions.push(...parseCategorization(text, new Set(cats.map((c) => c.id)), new Set(rest.map((t) => t.id))))
      ai = "used"
    } catch (e) {
      ai = "error"
      aiError = e instanceof AiHttpError ? (e.status === 401 || e.status === 403 ? "clé API refusée" : `erreur du fournisseur (HTTP ${e.status})`) : "assistant indisponible"
    }
  }
  return ok({
    total: uncategorized.length,
    ai, aiError,
    items: uncategorized.slice(0, 200).map((t) => ({ id: t.id, name: t.name, amountCents: t.amountCents, date: t.date, suggestion: suggestions.find((s) => s.id === t.id) ?? null })),
  })
}

// POST { assignments: [{ id, categoryId }] } : applique les suggestions acceptées.
export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { assignments } = (await req.json()) as { assignments?: { id: string; categoryId: string }[] }
  if (!Array.isArray(assignments) || assignments.length === 0 || assignments.length > 500) return err("assignments requis (500 max)")
  const valid = new Set(db.select().from(categories).where(eq(categories.householdId, householdId)).all().map((c) => c.id))
  let updated = 0
  for (const a of assignments) {
    if (typeof a.id !== "string" || !valid.has(a.categoryId)) continue
    const r = db.update(transactions).set({ categoryId: a.categoryId })
      .where(and(eq(transactions.id, a.id), eq(transactions.householdId, householdId), isNull(transactions.categoryId))).run()
    updated += r.changes
  }
  revalidateTag("transactions", { expire: 0 })
  return ok({ updated })
}
