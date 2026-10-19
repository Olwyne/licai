"use client"
import { useEffect, useState } from "react"
import { formatCents } from "@/lib/money"
import type { Category } from "@/db/schema"

interface Item { id: string; name: string; amountCents: number; date: string; suggestion: { categoryId: string; source: "history" | "ai"; confidence: number } | null }
interface Data { total: number; ai: "unavailable" | "used" | "error"; aiError: string; items: Item[] }

// Catégorisation assistée : l'historique du foyer d'abord, l'IA (si une clé est configurée) pour le reste. Rien n'est appliqué sans validation.
export function CategorizeModal({ categories, onClose, onApplied }: {
  categories: Category[]; onClose: () => void; onApplied: (assignments: { id: string; categoryId: string }[]) => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    fetch("/api/transactions/categorize").then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))).then((j: { data: Data }) => {
      if (!live) return
      setData(j.data)
      setChoice(Object.fromEntries(j.data.items.filter((i) => i.suggestion).map((i) => [i.id, i.suggestion!.categoryId])))
      setChecked(Object.fromEntries(j.data.items.filter((i) => i.suggestion && i.suggestion.confidence >= 0.6).map((i) => [i.id, true])))
    }).catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [])

  const selected = (data?.items ?? []).filter((i) => checked[i.id] && choice[i.id])

  async function apply() {
    setBusy(true); setError("")
    const assignments = selected.map((i) => ({ id: i.id, categoryId: choice[i.id] }))
    const res = await fetch("/api/transactions/categorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignments }) })
    setBusy(false)
    if (!res.ok) { setError("Erreur lors de l'application."); return }
    onApplied(assignments)
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>Catégoriser les transactions</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}
          {!data && !error && <div className="empty"><i aria-hidden="true" className="ti ti-loader" />Analyse en cours…</div>}
          {data && (
            <>
              <div className="field-hint" style={{ marginBottom: 10 }}>
                {data.total} transaction{data.total > 1 ? "s" : ""} sans catégorie. Les suggestions viennent de votre historique (même commerçant)
                {data.ai === "used" ? " et de l'assistant IA" : data.ai === "error" ? ` — l'assistant IA n'a pas répondu (${data.aiError})` : " ; ajoutez une clé API dans Paramètres pour que l'IA traite aussi les autres"}.
                Vérifiez, corrigez si besoin, puis appliquez.
              </div>
              {data.items.length === 0 ? <div className="empty"><i aria-hidden="true" className="ti ti-circle-check" />Toutes vos transactions sont catégorisées.</div> : (
                <div className="q-list" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                  {data.items.map((i) => (
                    <div className="q-row" key={i.id} style={{ gridTemplateColumns: "20px minmax(0,1fr) 90px minmax(120px,170px)" }}>
                      <input type="checkbox" aria-label={`Appliquer à ${i.name}`} checked={Boolean(checked[i.id])} disabled={!choice[i.id]} onChange={(e) => setChecked((p) => ({ ...p, [i.id]: e.target.checked }))} />
                      <span className="q-name" title={i.name}>{i.name}<small style={{ display: "block", color: "var(--fg-muted)" }}>{i.date}{i.suggestion ? ` · ${i.suggestion.source === "ai" ? "IA" : "historique"} ${Math.round(i.suggestion.confidence * 100)} %` : ""}</small></span>
                      <span className="q-src num">{formatCents(i.amountCents)}</span>
                      <select aria-label={`Catégorie de ${i.name}`} value={choice[i.id] ?? ""} onChange={(e) => { setChoice((p) => ({ ...p, [i.id]: e.target.value })); setChecked((p) => ({ ...p, [i.id]: Boolean(e.target.value) })) }}>
                        <option value="">— aucune —</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" type="button" onClick={() => void apply()} disabled={busy || selected.length === 0}><i aria-hidden="true" className="ti ti-check" /> Appliquer ({selected.length})</button>
        </div>
      </div>
    </div>
  )
}
