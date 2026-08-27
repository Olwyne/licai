"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { formatCents } from "@/lib/money"
import type { Transaction, Account, Category } from "@/db/schema"

interface Props {
  editingTx: Transaction | null
  accounts: Account[]
  categories: Category[]
  onSaved: (tx: Transaction) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

interface ApiResponse {
  data: Transaction
}

function centsToEurStr(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2).replace(".", ",")
}

export function TransactionModal({
  editingTx,
  accounts,
  categories,
  onSaved,
  onDeleted,
  onClose,
}: Props) {
  const isEdit = editingTx !== null
  const today = new Date().toISOString().slice(0, 10)

  const initType: "expense" | "income" =
    editingTx && editingTx.amountCents > 0 ? "income" : "expense"

  const [name, setName] = useState(editingTx?.name ?? "")
  const [amount, setAmount] = useState(
    editingTx ? centsToEurStr(editingTx.amountCents) : ""
  )
  const [txType, setTxType] = useState<"expense" | "income">(initType)
  const [date, setDate] = useState(editingTx?.date ?? today)
  const [accountId, setAccountId] = useState(editingTx?.accountId ?? "")
  const [categoryId, setCategoryId] = useState(editingTx?.categoryId ?? "")
  const [note, setNote] = useState(editingTx?.note ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function parseAmountCents(): number {
    const normalized = amount.replace(/\s/g, "").replace(",", ".")
    const abs = Math.round(parseFloat(normalized) * 100)
    if (isNaN(abs)) return 0
    return txType === "expense" ? -abs : abs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Le nom est requis."); return }
    if (!amount.trim()) { setError("Le montant est requis."); return }
    if (!date) { setError("La date est requise."); return }

    const amountCents = parseAmountCents()
    setLoading(true)
    setError("")

    try {
      const body = {
        name: name.trim(),
        amountCents,
        date,
        accountId: accountId || null,
        categoryId: categoryId || null,
        note: note.trim(),
      }

      const url = isEdit ? `/api/transactions/${editingTx.id}` : "/api/transactions"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setError("Erreur lors de l'enregistrement.")
        return
      }

      const json = (await res.json()) as ApiResponse
      onSaved(json.data)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!confirm("Supprimer cette opération ?")) return
    setLoading(true)
    try {
      await fetch(`/api/transactions/${editingTx.id}`, { method: "DELETE" })
      onDeleted(editingTx.id)
    } catch {
      setError("Erreur lors de la suppression.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal tx-modal">
        <div className="modal-header">
          <h2>{isEdit ? "Modifier l'opération" : "Nouvelle opération"}</h2>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
            {/* Type toggle */}
            <div className="field">
              <label>Type</label>
              <div className="amode-btns">
                <button
                  type="button"
                  className={`amode-btn${txType === "expense" ? " active" : ""}`}
                  onClick={() => setTxType("expense")}
                >
                  Dépense
                </button>
                <button
                  type="button"
                  className={`amode-btn${txType === "income" ? " active" : ""}`}
                  onClick={() => setTxType("income")}
                >
                  Revenu
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="tx-name">Nom *</label>
              <input
                id="tx-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Libellé de l'opération"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="tx-amt">Montant (€) *</label>
              <input
                id="tx-amt"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="tx-date">Date *</label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="tx-account">Compte</label>
              <select id="tx-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">— Aucun —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="tx-cat">Catégorie</label>
              <select id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Aucune —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="tx-note">Note</label>
              <textarea
                id="tx-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optionnel…"
                rows={2}
                className="tx-modal-note"
              />
            </div>

            {isEdit && (
              <div className="tx-modal-hint">
                Solde actuel : {formatCents(editingTx.amountCents)}
              </div>
            )}

            {error && <div className="err on">{error}</div>}
          </div>

          <div className="modal-footer">
            {isEdit && (
              <Button
                variant="danger"
                type="button"
                size="sm"
                onClick={() => void handleDelete()}
                disabled={loading}
                className="tx-modal-del-spacer"
              >
                Supprimer
              </Button>
            )}
            <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
