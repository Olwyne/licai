"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import type { Member } from "./types"

const COLOR_PALETTE = [
  "#1D9E75",
  "#378ADD",
  "#7C6BD6",
  "#D4537E",
  "#EF9F27",
  "#D85A30",
]

interface Props {
  onClose: () => void
  onSaved: (member: Member) => void
}

export function MemberModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("Membre")
  const [colorHex, setColorHex] = useState(COLOR_PALETTE[0])
  const [monthlyIncome, setMonthlyIncome] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Le nom est requis.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const short = name.trim().split(/\s+/)[0] ?? name.trim()
      const monthlyIncomeCents = monthlyIncome
        ? Math.round(parseFloat(monthlyIncome.replace(",", ".")) * 100)
        : 0
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          short,
          role: role.trim() || "Membre",
          colorHex,
          monthlyIncomeCents: isNaN(monthlyIncomeCents) ? 0 : monthlyIncomeCents,
        }),
      })
      const json = (await res.json()) as { data: Member }
      if (!res.ok) {
        setError("Erreur lors de l'enregistrement.")
        return
      }
      onSaved(json.data)
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
          <h2>Ajouter une personne</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="member-name">Nom</label>
              <input
                id="member-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sophie Lambert"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="member-role">Rôle</label>
              <input
                id="member-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Membre"
              />
            </div>
            <div className="field">
              <label>Couleur</label>
              <div className="swatches">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch${colorHex === c ? " on" : ""}`}
                    style={{ background: c }}
                    onClick={() => setColorHex(c)}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="member-income">Revenu mensuel (€, optionnel)</label>
              <input
                id="member-income"
                type="number"
                min="0"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="2 500"
              />
            </div>
            {error && <div className="err on">{error}</div>}
          </div>
          <div className="modal-footer">
            <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : "Ajouter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
