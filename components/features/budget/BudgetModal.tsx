"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import type { Category } from "@/db/schema"
import type { EnrichedBudget } from "@/app/(app)/budget/page"

interface Props {
  budget: EnrichedBudget
  month: string
  categories: Category[]
  onClose: () => void
  onSaved: (updated: EnrichedBudget) => void
}

export function BudgetModal({ budget, month, categories, onClose, onSaved }: Props) {
  const [limitEuros, setLimitEuros] = useState(
    (budget.limitCents / 100).toFixed(2)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const category = categories.find((c) => c.id === budget.categoryId) ?? budget.category

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(limitEuros.replace(",", "."))
    if (isNaN(parsed) || parsed < 0) {
      setError("Montant invalide")
      return
    }
    const limitCents = Math.round(parsed * 100)
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          items: [{ categoryId: budget.categoryId, limitCents }],
        }),
      })
      if (!res.ok) {
        setError("Erreur lors de l'enregistrement.")
        return
      }
      onSaved({ ...budget, limitCents })
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Modifier le budget</h2>
          <button className="modal-close" onClick={onClose} type="button">
            <i className="ti ti-x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Catégorie</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {category && (
                <span style={{ color: category.colorHex }}>{category.icon}</span>
              )}
              <span>{category?.label ?? budget.categoryId}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="limitEuros">
              Plafond mensuel (€)
            </label>
            <input
              id="limitEuros"
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={limitEuros}
              onChange={(e) => setLimitEuros(e.target.value)}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-footer">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
