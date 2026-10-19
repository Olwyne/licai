"use client"
import { useState } from "react"
import type { Loan } from "@/db/schema"
import { useFinanceContext } from "@/components/features/finance/useFinanceContext"
import { MiniAv } from "@/components/features/finance/ui"

export const LOAN_KINDS = [
  { value: "immobilier", label: "Immobilier" },
  { value: "auto", label: "Auto" },
  { value: "travaux", label: "Travaux" },
  { value: "conso", label: "Consommation" },
  { value: "autre", label: "Autre" },
]

const num = (v: string) => parseFloat((v || "0").replace(/\s/g, "").replace(",", ".")) || 0
const eurStr = (cents: number) => String(cents / 100)
const ym = (v: string | null | undefined) => (v ? v.slice(0, 7) : "")
const parseIds = (s: string | undefined): string[] => { try { const v = JSON.parse(s ?? "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

export function LoanModal({ loan, defaultPropertyId, onClose, onDone }: {
  loan: Loan | null
  defaultPropertyId?: string | null
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = loan !== null
  const { ctx } = useFinanceContext()
  const [f, setF] = useState({
    name: loan?.name ?? "", kind: loan?.kind ?? "immobilier",
    initial: loan ? eurStr(loan.principalCents) : "", left: loan ? eurStr(loan.remainingCents) : "",
    monthly: loan ? eurStr(loan.monthlyPaymentCents) : "", rate: loan ? String(loan.ratePercent) : "",
    start: ym(loan?.startDate), end: ym(loan?.endDate),
    insurance: loan?.insuranceCents ? eurStr(loan.insuranceCents) : "",
    account: loan?.accountId ?? "", property: loan?.propertyId ?? defaultPropertyId ?? "", note: loan?.note ?? "",
  })
  const [owners, setOwners] = useState<string[]>(parseIds(loan?.ownerIds))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const toggle = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) { setError("L'intitulé est requis."); return }
    setBusy(true); setError("")
    const body = {
      name: f.name.trim(), kind: f.kind,
      principalCents: Math.round(num(f.initial) * 100), remainingCents: Math.round(num(f.left) * 100),
      monthlyPaymentCents: Math.round(num(f.monthly) * 100), ratePercent: num(f.rate),
      startDate: f.start || null, endDate: f.end || null,
      insuranceCents: Math.round(num(f.insurance) * 100), accountId: f.account || null, propertyId: f.property || null, ownerIds: owners, note: f.note,
    }
    try {
      const res = await fetch(isEdit ? `/api/credits/${loan.id}` : "/api/credits", {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      onDone()
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!loan) return
    setBusy(true)
    try {
      const res = await fetch(`/api/credits/${loan.id}`, { method: "DELETE" })
      if (!res.ok) { setError("Erreur lors de la suppression."); return }
      onDone()
    } finally { setBusy(false) }
  }

  const amount = (label: string, k: keyof typeof f, ph: string, unit = "€") => (
    <div className="field"><label>{label}</label>
      <div className="field-amount"><input type="text" inputMode="decimal" placeholder={ph} value={f[k]} onChange={(e) => set(k)(e.target.value)} /><span className="cur">{unit}</span></div></div>
  )
  const adults = ctx?.members.filter((m) => !m.isChild) ?? []

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le crédit" : "Ajouter un crédit"}</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}
            <div className="field-row">
              <div className="field"><label>Intitulé</label><input type="text" placeholder="ex. Prêt résidence principale" value={f.name} onChange={(e) => set("name")(e.target.value)} required autoFocus /></div>
              <div className="field"><label>Type</label>
                <select value={f.kind} onChange={(e) => set("kind")(e.target.value)}>{LOAN_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
            </div>
            <div className="field-row">{amount("Montant emprunté", "initial", "220 000")}{amount("Capital restant dû", "left", "186 400")}</div>
            <div className="field-row">{amount("Mensualité (assurance incluse)", "monthly", "980")}{amount("Taux annuel", "rate", "1,35", "%")}</div>
            <div className="field-row">{amount("dont assurance emprunteur (par mois)", "insurance", "35")}<div className="field" /></div>
            <div className="field-row">
              <div className="field"><label>Début</label><input type="month" value={f.start} onChange={(e) => set("start")(e.target.value)} /></div>
              <div className="field"><label>Fin prévue</label><input type="month" value={f.end} onChange={(e) => set("end")(e.target.value)} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Compte de prélèvement</label>
                <select value={f.account} onChange={(e) => set("account")(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {ctx?.cash.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></div>
              <div className="field"><label>Bien financé</label>
                <select value={f.property} onChange={(e) => set("property")(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {ctx?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
            </div>
            <div className="field"><label>Emprunteur(s)</label>
              <div className="owner-picker">
                {adults.map((m) => (
                  <button key={m.id} type="button" className={`owner-opt${owners.includes(m.id) ? " on" : ""}`} onClick={() => toggle(m.id)}><MiniAv m={m} size={24} /> {m.short}</button>
                ))}
              </div>
            </div>
            <div className="field"><label>Note</label><input type="text" placeholder="BNP Paribas, PEL…" value={f.note} onChange={(e) => set("note")(e.target.value)} /></div>
          </div>
          <div className="modal-foot">
            {isEdit && <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "#D85A30" }} onClick={remove} disabled={busy}><i aria-hidden="true" className="ti ti-trash" /> Supprimer</button>}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={busy}><i aria-hidden="true" className="ti ti-check" /> {busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
