"use client"
import { useState } from "react"
import type { Member } from "./types"

const COLOR_PALETTE = ["#1D9E75", "#378ADD", "#7C6BD6", "#D4537E", "#EF9F27", "#D85A30", "#888780"]
const ROLES = ["Membre", "Administratrice", "Administrateur", "Enfant (lecture)", "Invité (lecture)"]
const num = (v: string) => parseFloat(v.replace(/\s/g, "").replace(",", "."))

interface Props {
  onClose: () => void
  onSaved: (member: Member) => void
}

export function MemberModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("Membre")
  const [colorHex, setColorHex] = useState(COLOR_PALETTE[0])
  const [monthlyIncome, setMonthlyIncome] = useState("")
  const [allowance, setAllowance] = useState("")
  const [birthYear, setBirthYear] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isChild = role === "Enfant (lecture)"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Le nom est requis."); return }
    setLoading(true)
    setError("")
    try {
      const income = !isChild && monthlyIncome ? Math.round(num(monthlyIncome) * 100) : 0
      const poche = isChild && allowance ? Math.round(num(allowance) * 100) : 0
      const res = await fetch("/api/members", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), short: name.trim().split(/\s+/)[0] ?? name.trim(), role, colorHex,
          monthlyIncomeCents: isNaN(income) ? 0 : income, isChild, allowanceCents: isNaN(poche) ? 0 : poche,
          birthYear: birthYear ? parseInt(birthYear, 10) : null,
        }),
      })
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      onSaved(((await res.json()) as { data: Member }).data)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>Ajouter une personne au foyer</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            <div className="field"><label htmlFor="member-name">Nom complet</label>
              <input id="member-name" type="text" placeholder="ex. Thomas Roux" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></div>
            <div className="field"><label htmlFor="member-role">Rôle dans le foyer</label>
              <select id="member-role" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div className="field"><label>Couleur</label>
              <div className="color-picker">{COLOR_PALETTE.map((c) => <button key={c} type="button" className={`swatch${colorHex === c ? " on" : ""}`} style={{ background: c }} onClick={() => setColorHex(c)} aria-label={c} />)}</div></div>
            <div className="field-row">
              <div className="field"><label htmlFor="member-birth">Année de naissance <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optionnel)</span></label>
                <input id="member-birth" type="text" inputMode="numeric" maxLength={4} placeholder={isChild ? "2015" : "1988"} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))} /></div>
              {isChild ? (
                <div className="field"><label htmlFor="member-allowance">Argent de poche / mois <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optionnel)</span></label>
                  <div className="field-amount"><input id="member-allowance" type="text" inputMode="decimal" placeholder="50" value={allowance} onChange={(e) => setAllowance(e.target.value)} /><span className="cur">€</span></div></div>
              ) : (
                <div className="field"><label htmlFor="member-income">Revenu mensuel <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optionnel)</span></label>
                  <div className="field-amount"><input id="member-income" type="text" inputMode="decimal" placeholder="2 500" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} /><span className="cur">€</span></div></div>
              )}
            </div>
            <div className="field-hint">Une personne peut être titulaire de plusieurs comptes, dans une ou plusieurs banques.</div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}><i className="ti ti-check" /> {loading ? "Enregistrement…" : "Ajouter"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
