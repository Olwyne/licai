"use client"
import { useState } from "react"
import type { Category } from "@/db/schema"
import type { EnrichedBudget } from "@/app/(app)/budget/page"

const SUGGESTIONS = [
  // Vie quotidienne
  { label: "Alimentation",  icon: "ti-basket",           colorHex: "#1D9E75" },
  { label: "Restaurants",   icon: "ti-tools-kitchen-2",  colorHex: "#EF9F27" },
  { label: "Café & bars",   icon: "ti-coffee",           colorHex: "#C68642" },
  // Logement & maison
  { label: "Logement",      icon: "ti-home",             colorHex: "#888780" },
  { label: "Charges",       icon: "ti-bolt",             colorHex: "#F39C12" },
  { label: "Entretien",     icon: "ti-tool",             colorHex: "#7F8C8D" },
  // Transport
  { label: "Transport",     icon: "ti-train",            colorHex: "#378ADD" },
  { label: "Voiture",       icon: "ti-car",              colorHex: "#2980B9" },
  { label: "Carburant",     icon: "ti-gas-station",      colorHex: "#5D6D7E" },
  // Santé & bien-être
  { label: "Santé",         icon: "ti-pill",             colorHex: "#D85A30" },
  { label: "Médecin",       icon: "ti-stethoscope",      colorHex: "#E74C3C" },
  { label: "Sport",         icon: "ti-dumbbell",         colorHex: "#27AE60" },
  // Loisirs & culture
  { label: "Loisirs",       icon: "ti-device-tv",        colorHex: "#7C6BD6" },
  { label: "Musique",       icon: "ti-music",            colorHex: "#8E44AD" },
  { label: "Voyages",       icon: "ti-plane",            colorHex: "#3498DB" },
  { label: "Hôtel",         icon: "ti-bed",              colorHex: "#1ABC9C" },
  { label: "Cinéma",        icon: "ti-movie",            colorHex: "#9B59B6" },
  { label: "Jeux",          icon: "ti-device-gamepad",   colorHex: "#6C5CE7" },
  // Shopping
  { label: "Shopping",      icon: "ti-shirt",            colorHex: "#D4537E" },
  { label: "Cadeaux",       icon: "ti-gift",             colorHex: "#E91E8C" },
  { label: "Beauté",        icon: "ti-sparkles",         colorHex: "#FF6B9D" },
  // Famille & éducation
  { label: "Éducation",     icon: "ti-school",           colorHex: "#F39C12" },
  { label: "Enfants",       icon: "ti-baby-carriage",    colorHex: "#FFC107" },
  { label: "Animaux",       icon: "ti-paw",              colorHex: "#795548" },
  // Finances
  { label: "Épargne",       icon: "ti-pig-money",        colorHex: "#2ECC71" },
  { label: "Investissement", icon: "ti-trending-up",     colorHex: "#00BCD4" },
  { label: "Assurance",     icon: "ti-shield-check",     colorHex: "#607D8B" },
  // Abonnements & services
  { label: "Abonnements",   icon: "ti-receipt-2",        colorHex: "#9B59B6" },
  { label: "Internet",      icon: "ti-wifi",             colorHex: "#3498DB" },
  { label: "Téléphone",     icon: "ti-device-mobile",    colorHex: "#2C3E50" },
  // Divers
  { label: "Taxes",         icon: "ti-building-bank",    colorHex: "#455A64" },
  { label: "Divers",        icon: "ti-dots-circle-horizontal", colorHex: "#95A5A6" },
]
const PALETTE = ["#1D9E75", "#378ADD", "#7C6BD6", "#D4537E", "#EF9F27", "#D85A30", "#888780"]
const ICONS = ["ti-basket", "ti-home", "ti-train", "ti-device-tv", "ti-shirt", "ti-pill", "ti-book", "ti-paw", "ti-gift", "ti-plane", "ti-school", "ti-tools"]

interface Props {
  month: string
  categories: Category[]
  budget: EnrichedBudget | null
  onClose: () => void
  onSaved: (cat: Category, budget: EnrichedBudget) => void
  onRemoved: (budgetId: string) => void
}

export function CategoryModal({ month, categories, budget, onClose, onSaved, onRemoved }: Props) {
  const isEdit = budget !== null
  const current = isEdit ? categories.find((c) => c.id === budget.categoryId) ?? budget.category : null
  const [label, setLabel] = useState(current?.label ?? "")
  const [color, setColor] = useState(current?.colorHex ?? PALETTE[0])
  const [icon, setIcon] = useState(current?.icon ?? ICONS[0])
  const [cap, setCap] = useState(budget ? String(budget.limitCents / 100) : "")
  const [existingId, setExistingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const budgeted = new Set<string>()
  const icons = ICONS.includes(icon) ? ICONS : [icon, ...ICONS]
  const palette = PALETTE.includes(color) ? PALETTE : [...PALETTE, color]
  const suggestions = isEdit ? [] : SUGGESTIONS.filter((d) => !categories.some((c) => c.label === d.label)).slice(0, 10)
  const existing = isEdit ? [] : categories.filter((c) => !budgeted.has(c.id)).slice(0, 10)

  function pick(c: { label: string; icon: string; colorHex: string }, id: string | null) {
    setLabel(c.label); setIcon(c.icon); setColor(c.colorHex); setExistingId(id)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) { setError("Le nom est requis."); return }
    const limit = parseFloat(cap.replace(/\s/g, "").replace(",", ".")) || 0
    setBusy(true); setError("")
    try {
      let cat: Category
      if (isEdit && current) {
        cat = { ...current, label: label.trim(), icon, colorHex: color }
        if (cat.label !== current.label || cat.icon !== current.icon || cat.colorHex !== current.colorHex) {
          const r = await fetch(`/api/categories/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: cat.label, icon, colorHex: color }) })
          if (!r.ok) { setError("Erreur lors de la mise à jour de la catégorie."); return }
        }
      } else if (existingId) {
        cat = categories.find((c) => c.id === existingId)!
      } else {
        const r = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim(), icon, colorHex: color }) })
        if (!r.ok) { setError("Erreur lors de la création de la catégorie."); return }
        cat = ((await r.json()) as { data: Category }).data
      }
      if (limit <= 0 && isEdit && budget) { await remove(true); return }
      const limitCents = Math.round(limit * 100)
      const b = await fetch("/api/budget", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, items: [{ categoryId: cat.id, limitCents }] }) })
      if (!b.ok) { setError("Erreur lors de l'enregistrement du plafond."); return }
      const rows = ((await b.json()) as { data: { id: string; categoryId: string }[] }).data
      const row = rows.find((x) => x.categoryId === cat.id)
      onSaved(cat, { ...(budget ?? { spentCents: 0 }), ...(row ?? {}), limitCents, spentCents: budget?.spentCents ?? 0, category: cat } as EnrichedBudget)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(silent = false) {
    if (!budget) return
    if (!silent) setBusy(true)
    const r = await fetch(`/api/budget?month=${month}&categoryId=${budget.categoryId}`, { method: "DELETE" })
    setBusy(false)
    if (!r.ok) { setError("Erreur lors du retrait."); return }
    onRemoved(budget.id)
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier la catégorie" : "Ajouter une catégorie"}</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            {!isEdit && (existing.length > 0 || suggestions.length > 0) && (
              <div className="field">
                <label>Suggestions</label>
                <div className="chips">
                  {existing.map((c) => <button key={c.id} type="button" className={`chip${existingId === c.id ? " active" : ""}`} onClick={() => pick(c, c.id)}><i className={`ti ${c.icon}`} /> {c.label}</button>)}
                  {suggestions.map((d) => <button key={d.label} type="button" className="chip" onClick={() => pick(d, null)}><i className={`ti ${d.icon}`} /> {d.label}</button>)}
                </div>
              </div>
            )}
            <div className="field"><label>Nom de la catégorie</label>
              <input type="text" placeholder="ex. Éducation" value={label} onChange={(e) => { setLabel(e.target.value); setExistingId(null) }} disabled={!!existingId} autoFocus /></div>
            <div className="field"><label>Plafond mensuel</label>
              <div className="field-amount"><input type="text" inputMode="decimal" placeholder="200" value={cap} onChange={(e) => setCap(e.target.value)} /><span className="cur">€</span></div>
              <div className="field-hint">0 € = pas d&apos;objectif, la catégorie n&apos;apparaît plus dans le budget.</div></div>
            <div className="field"><label>Couleur</label>
              <div className="color-picker">{palette.map((c) => <button key={c} type="button" className={`swatch${c === color ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} disabled={!!existingId} />)}</div></div>
            <div className="field"><label>Icône</label>
              <div className="icon-picker">{icons.map((i) => <button key={i} type="button" className={`icon-opt${i === icon ? " on" : ""}`} onClick={() => setIcon(i)} aria-label={i} disabled={!!existingId}><i className={`ti ${i}`} /></button>)}</div></div>
          </div>
          <div className="modal-foot">
            {isEdit && <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "#D85A30" }} onClick={() => void remove()} disabled={busy}><i className="ti ti-trash" /> Retirer du budget</button>}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={busy}><i className="ti ti-check" /> {busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
