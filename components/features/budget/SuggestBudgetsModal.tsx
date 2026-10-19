"use client"
import { useEffect, useState } from "react"

interface Item { categoryId: string; label: string; icon: string; colorHex: string; months: number; avg: number; median: number; suggested: number; current: number | null }

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

// Plafonds suggérés d'après les dépenses réelles des 6 derniers mois complets (médiane + 5 %). Rien n'est appliqué sans validation.
export function SuggestBudgetsModal({ month, onClose, onApplied }: { month: string; onClose: () => void; onApplied: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    fetch(`/api/budget/suggestions?month=${month}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))).then((j: { data: { items: Item[] } }) => {
      if (!live) return
      setItems(j.data.items)
      setValues(Object.fromEntries(j.data.items.map((i) => [i.categoryId, String(i.suggested)])))
      setChecked(Object.fromEntries(j.data.items.map((i) => [i.categoryId, i.current === null || Math.abs(i.current - i.suggested) / Math.max(i.suggested, 1) > 0.05])))
    }).catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [month])

  const picked = (items ?? []).filter((i) => checked[i.categoryId] && Number(values[i.categoryId]) > 0)

  async function apply() {
    setBusy(true); setError("")
    const res = await fetch("/api/budget", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, items: picked.map((i) => ({ categoryId: i.categoryId, limitCents: Math.round(Number(values[i.categoryId]) * 100) })) }) })
    setBusy(false)
    if (!res.ok) { setError("Erreur lors de l'application."); return }
    onApplied()
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>Plafonds suggérés</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}
          {!items && !error && <div className="empty"><i aria-hidden="true" className="ti ti-loader" />Analyse de l&apos;historique…</div>}
          {items && items.length === 0 && <div className="empty"><i aria-hidden="true" className="ti ti-chart-bar-off" />Pas assez d&apos;historique : il faut au moins 2 mois de dépenses par catégorie.</div>}
          {items && items.length > 0 && (
            <>
              <div className="field-hint" style={{ marginBottom: 10 }}>Basé sur la médiane des dépenses mensuelles des 6 derniers mois complets, majorée de 5 % et arrondie. Modifiez les montants si besoin.</div>
              <div className="q-list" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                {items.map((i) => (
                  <div className="q-row" key={i.categoryId} style={{ gridTemplateColumns: "20px minmax(0,1fr) 110px 110px 96px" }}>
                    <input type="checkbox" aria-label={`Appliquer pour ${i.label}`} checked={Boolean(checked[i.categoryId])} onChange={(e) => setChecked((p) => ({ ...p, [i.categoryId]: e.target.checked }))} />
                    <span className="q-name"><i aria-hidden="true" className={`ti ${i.icon}`} style={{ color: i.colorHex, marginRight: 6 }} />{i.label}<small style={{ display: "block", color: "var(--fg-muted)" }}>{i.months} mois de données</small></span>
                    <span className="q-src num">habituel {eur(i.median)}</span>
                    <span className="q-src num">{i.current === null ? "pas de plafond" : `actuel ${eur(i.current)}`}</span>
                    <input className="q-input num" type="text" inputMode="decimal" aria-label={`Plafond suggéré pour ${i.label}`} value={values[i.categoryId] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [i.categoryId]: e.target.value.replace(",", ".") }))} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" type="button" onClick={() => void apply()} disabled={busy || picked.length === 0}><i aria-hidden="true" className="ti ti-check" /> Appliquer ({picked.length})</button>
        </div>
      </div>
    </div>
  )
}
