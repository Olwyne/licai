// Catégorisation des transactions : apprentissage sur l'historique du foyer (gratuit, instantané), puis IA pour le reste.

/** Nom de commerçant normalisé : minuscules, sans accents, sans chiffres/dates/références ni mots génériques de relevé bancaire. */
export function normalizeMerchant(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(cb|carte|paiement|prlv|prelevement|vir|virement|sepa|retrait|achat|facture|fact|commande|ref|id)\b/g, " ")
    .replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim()
}

export interface CatTx { id: string; name: string; categoryId: string | null; amountCents: number }
export interface CatSuggestion { id: string; categoryId: string; source: "history" | "ai"; confidence: number }

/**
 * Propose une catégorie aux transactions sans catégorie d'après les transactions déjà catégorisées du foyer portant le même
 * nom de commerçant. Confiance = part de la catégorie dominante, pondérée par le nombre d'exemples.
 */
export function suggestFromHistory(uncategorized: CatTx[], categorized: CatTx[], minConfidence = 0.6): CatSuggestion[] {
  const byMerchant = new Map<string, Map<string, number>>()
  for (const t of categorized) {
    if (!t.categoryId) continue
    const key = normalizeMerchant(t.name)
    if (key.length < 3) continue
    const m = byMerchant.get(key) ?? new Map<string, number>()
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
    byMerchant.set(key, m)
  }
  const out: CatSuggestion[] = []
  for (const t of uncategorized) {
    const m = byMerchant.get(normalizeMerchant(t.name))
    if (!m) continue
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    const [categoryId, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    const confidence = (n / total) * Math.min(1, 0.5 + 0.25 * n) // 1 exemple → 0,75 · 2 → 1
    if (confidence >= minConfidence) out.push({ id: t.id, categoryId, source: "history", confidence: Math.round(confidence * 100) / 100 })
  }
  return out
}

export interface CatOption { id: string; label: string }

/** Consigne et message envoyés au modèle : il ne doit répondre que par un JSON listant des catégories existantes. */
export function categorizationPrompt(categories: CatOption[], txs: CatTx[]): { system: string; user: string } {
  return {
    system: "Tu classes des transactions bancaires d'un foyer français dans des catégories. Réponds UNIQUEMENT par un tableau JSON, sans texte autour : [{\"id\": \"…\", \"categoryId\": \"…\", \"confidence\": 0.0-1.0}]. N'utilise que les categoryId fournis ; omets une transaction si tu n'es pas raisonnablement sûr.",
    user: JSON.stringify({
      categories: categories.map((c) => ({ categoryId: c.id, label: c.label })),
      transactions: txs.map((t) => ({ id: t.id, libelle: t.name, montant: Math.round(t.amountCents) / 100 })),
    }),
  }
}

/** Réponse du modèle → suggestions valides (JSON éventuellement entouré de texte ou de ```), catégories inconnues écartées. */
export function parseCategorization(text: string, validCategoryIds: Set<string>, validTxIds: Set<string>): CatSuggestion[] {
  const start = text.indexOf("["), end = text.lastIndexOf("]")
  if (start < 0 || end <= start) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as { id?: unknown; categoryId?: unknown; confidence?: unknown }[]
    const seen = new Set<string>()
    const out: CatSuggestion[] = []
    for (const r of arr) {
      if (typeof r.id !== "string" || typeof r.categoryId !== "string") continue
      if (!validTxIds.has(r.id) || !validCategoryIds.has(r.categoryId) || seen.has(r.id)) continue
      seen.add(r.id)
      const c = typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1 ? r.confidence : 0.5
      out.push({ id: r.id, categoryId: r.categoryId, source: "ai", confidence: Math.round(c * 100) / 100 })
    }
    return out
  } catch { return [] }
}
