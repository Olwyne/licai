"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import type { Recurring, Account, Category } from "@/db/schema"

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "annual", label: "Annuel" },
] as const

const KIND_OPTIONS = [
  { value: "charge", label: "Charge" },
  { value: "subscription", label: "Abonnement" },
  { value: "saving", label: "Épargne" },
] as const

interface Props {
  item: Recurring | null
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSaved: (item: Recurring) => void
  onDeleted: (id: string) => void
}

export function RecurringModal({
  item,
  accounts,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [name, setName] = useState(item?.name ?? "")
  const [amountEuros, setAmountEuros] = useState(
    item ? (item.amountCents / 100).toFixed(2) : ""
  )
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "annual">(
    item?.frequency ?? "monthly"
  )
  const [kind, setKind] = useState<"charge" | "subscription" | "saving">(
    item?.kind ?? "charge"
  )
  const [nextDate, setNextDate] = useState(item?.nextDate ?? "")
  const [accountId, setAccountId] = useState(item?.accountId ?? "")
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const isEdit = item !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amountEuros.replace(",", "."))
    if (!name.trim() || isNaN(parsed) || !nextDate) {
      setError("Nom, montant et date sont requis.")
      return
    }
    const amountCents = Math.round(parsed * 100)
    setLoading(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        amountCents,
        frequency,
        kind,
        nextDate,
        accountId: accountId || null,
        categoryId: categoryId || null,
      }
      const res = await fetch(
        isEdit ? `/api/recurring/${item.id}` : "/api/recurring",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        setError("Erreur lors de l'enregistrement.")
        return
      }
      const json = (await res.json()) as { data: Recurring }
      onSaved(json.data)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/recurring/${item.id}`, { method: "DELETE" })
      if (res.ok) {
        onDeleted(item.id)
      } else {
        setError("Erreur lors de la suppression.")
      }
    } catch {
      setError("Erreur réseau.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? "Modifier" : "Ajouter"} un élément récurrent
          </h2>
          <button className="modal-close" onClick={onClose} type="button">
            <i className="ti ti-x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="rec-name">Nom</label>
            <input
              id="rec-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rec-amount">Montant (€)</label>
            <input
              id="rec-amount"
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={amountEuros}
              onChange={(e) => setAmountEuros(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rec-freq">Fréquence</label>
            <select
              id="rec-freq"
              className="form-input"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rec-kind">Nature</label>
            <select
              id="rec-kind"
              className="form-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rec-date">
              Prochain prélèvement
            </label>
            <input
              id="rec-date"
              className="form-input"
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rec-account">Compte</label>
            <select
              id="rec-account"
              className="form-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">— Aucun —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rec-cat">Catégorie</label>
            <select
              id="rec-cat"
              className="form-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-footer">
            {isEdit && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </Button>
            )}
            <div style={{ flex: 1 }} />
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
