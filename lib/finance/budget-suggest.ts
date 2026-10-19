// Plafonds de budget suggérés à partir des dépenses réelles des derniers mois.

export interface SpendTx { categoryId: string | null; amountCents: number; date: string }
export interface BudgetSuggestion { categoryId: string; months: number; avg: number; median: number; suggested: number }

const monthKey = (d: string) => d.slice(0, 7)
const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** Arrondi « budget » : 5 € sous 50 €, 10 € sous 500 €, sinon 50 €. */
export function roundBudget(x: number): number {
  const step = x < 50 ? 5 : x < 500 ? 10 : 50
  return Math.ceil(x / step) * step
}

/**
 * Pour chaque catégorie : moyenne et médiane des dépenses mensuelles sur les `months` derniers mois COMPLETS (le mois en cours
 * est exclu). Suggestion = médiane (robuste aux mois exceptionnels) majorée de 5 %, arrondie. Catégories avec moins de
 * 2 mois de dépenses ou moins de 10 € par mois ignorées. Montants en euros.
 */
export function suggestBudgets(txs: SpendTx[], today: string, months = 6): BudgetSuggestion[] {
  const current = monthKey(today)
  const [y, m] = current.split("-").map(Number)
  const window = new Set(Array.from({ length: months }, (_, i) => { const d = new Date(y, m - 2 - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }))
  const perCat = new Map<string, Map<string, number>>()
  for (const t of txs) {
    if (!t.categoryId || t.amountCents >= 0) continue
    const k = monthKey(t.date)
    if (!window.has(k)) continue
    const c = perCat.get(t.categoryId) ?? new Map<string, number>()
    c.set(k, (c.get(k) ?? 0) + Math.abs(t.amountCents) / 100)
    perCat.set(t.categoryId, c)
  }
  const out: BudgetSuggestion[] = []
  for (const [categoryId, byMonth] of perCat) {
    const vals = [...byMonth.values()]
    if (vals.length < 2) continue
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const med = median(vals)
    if (med < 10) continue
    out.push({ categoryId, months: vals.length, avg: Math.round(avg), median: Math.round(med), suggested: roundBudget(med * 1.05) })
  }
  return out.sort((a, b) => b.suggested - a.suggested)
}
