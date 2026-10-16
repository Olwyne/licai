"use client"
import { useState } from "react"
import type { Recurring, Account, Category, Member } from "@/db/schema"
import { MiniAv } from "@/components/features/finance/ui"

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensuelle" },
  { value: "quarterly", label: "Trimestrielle" },
  { value: "annual", label: "Annuelle" },
] as const

const KIND_OPTIONS = [
  { value: "charge", label: "Charge fixe" },
  { value: "subscription", label: "Abonnement" },
  { value: "insurance", label: "Assurance" },
  { value: "saving", label: "Épargne auto" },
] as const

interface Props {
  item: Recurring | null
  accounts: Account[]
  categories: Category[]
  members: Member[]
  onClose: () => void
  onSaved: (item: Recurring) => void
  onDeleted: (id: string) => void
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Prochaine date de prélèvement pour un jour du mois (en conservant mois/année d'une date existante). */
function dateForDay(day: number, existing: string | undefined): string {
  const clamp = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate())
  if (existing) {
    const [y, m] = existing.split("-").map(Number)
    return iso(new Date(y, m - 1, clamp(y, m - 1)))
  }
  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth()
  if (clamp(y, m) < now.getDate()) { m += 1; if (m > 11) { m = 0; y += 1 } }
  return iso(new Date(y, m, clamp(y, m)))
}

const parseIds = (s: string | undefined): string[] => { try { const v = JSON.parse(s ?? "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }

export function RecurringModal({ item, accounts, categories, members, onClose, onSaved, onDeleted }: Props) {
  const isEdit = item !== null
  const [name, setName] = useState(item?.name ?? "")
  const [amount, setAmount] = useState(item ? (Math.abs(item.amountCents) / 100).toFixed(2).replace(".", ",") : "")
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "annual">(item?.frequency ?? "monthly")
  const [kind, setKind] = useState<"charge" | "subscription" | "insurance" | "saving">(item?.kind ?? "charge")
  const [day, setDay] = useState(item ? String(Number(item.nextDate.slice(8, 10))) : "")
  const [accountId, setAccountId] = useState(item?.accountId ?? "")
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "")
  const [owners, setOwners] = useState<string[]>(parseIds(item?.ownerIds))
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const toggle = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount.replace(/\s/g, "").replace(",", "."))
    const d = parseInt(day, 10)
    if (!name.trim() || isNaN(parsed) || !(d >= 1 && d <= 31)) { setError("Intitulé, montant et jour (1–31) sont requis."); return }
    setLoading(true); setError("")
    try {
      const payload = {
        name: name.trim(), amountCents: Math.round(Math.abs(parsed) * 100), frequency, kind,
        nextDate: dateForDay(d, item?.nextDate),
        accountId: accountId || null, categoryId: categoryId || null, ownerIds: owners,
      }
      const res = await fetch(isEdit ? `/api/recurring/${item.id}` : "/api/recurring", {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      onSaved(((await res.json()) as { data: Recurring }).data)
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
      if (res.ok) onDeleted(item.id)
      else setError("Erreur lors de la suppression.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier la dépense récurrente" : "Ajouter une dépense récurrente"}</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            <div className="field-row">
              <div className="field"><label htmlFor="rec-name">Intitulé</label>
                <input id="rec-name" type="text" placeholder="ex. Assurance habitation" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></div>
              <div className="field"><label htmlFor="rec-kind">Nature</label>
                <select id="rec-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="rec-amount">Montant</label>
                <div className="field-amount"><input id="rec-amount" type="text" inputMode="decimal" placeholder="13,49" value={amount} onChange={(e) => setAmount(e.target.value)} required /><span className="cur">€</span></div></div>
              <div className="field"><label htmlFor="rec-freq">Fréquence</label>
                <select id="rec-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>{FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="rec-day">Jour de prélèvement</label>
                <input id="rec-day" type="text" inputMode="numeric" placeholder="5" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} required /></div>
              <div className="field"><label htmlFor="rec-cat">Catégorie</label>
                <select id="rec-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— Aucune —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select></div>
            </div>
            <div className="field"><label htmlFor="rec-account">Compte prélevé</label>
              <select id="rec-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">— Aucun —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div className="field"><label>À la charge de</label>
              <div className="owner-picker">
                {members.filter((m) => !m.isChild).map((m) => (
                  <button key={m.id} type="button" className={`owner-opt${owners.includes(m.id) ? " on" : ""}`} onClick={() => toggle(m.id)}>
                    <MiniAv m={{ id: m.id, name: m.name, short: m.short, role: m.role, color: m.colorHex, incomeMonthly: 0, birthYear: null, isChild: false }} size={24} /> {m.short}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-foot">
            {isEdit && <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "#D85A30" }} onClick={handleDelete} disabled={deleting}><i className="ti ti-trash" /> {deleting ? "Suppression…" : "Supprimer"}</button>}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}><i className="ti ti-check" /> {loading ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
