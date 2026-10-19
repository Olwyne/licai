"use client"
import { useState } from "react"
import { CURRENCIES, currencySym, getBaseCurrency } from "@/lib/finance/fx"
import type { EnrichedAccount, Member, Bank } from "./types"
import type { Account } from "@/db/schema"

const TYPE_OPTIONS = [
  { value: "checking", label: "Courant" },
  { value: "savings", label: "Épargne" },
  { value: "card", label: "Carte" },
  { value: "investment", label: "Investissement" },
  { value: "other", label: "Autre" },
] as const

const BANK_COLORS = ["#1D9E75", "#378ADD", "#7C6BD6", "#D4537E", "#EF9F27", "#D85A30", "#888780"]

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()
}

interface Props {
  members: Member[]
  banks: Bank[]
  account?: EnrichedAccount | null
  onClose: () => void
  onSaved: (account: Omit<EnrichedAccount, "balanceBaseCents">) => void
  onDeleted?: (id: string) => void
  onBankCreated?: (bank: Bank) => void
}

export function AccountModal({ members, banks, account, onClose, onSaved, onDeleted, onBankCreated }: Props) {
  const isEdit = !!account
  const [name, setName] = useState(account?.name ?? "")
  const [type, setType] = useState<"checking" | "savings" | "investment" | "card" | "other">(account?.type ?? "checking")
  const [bankId, setBankId] = useState(account?.bankId ?? banks[0]?.id ?? "")
  const [balance, setBalance] = useState(account ? String(account.balanceCents / 100) : "")
  const [currency, setCurrency] = useState(account?.currency ?? getBaseCurrency())
  const [last4, setLast4] = useState(account?.last4 ?? "")
  const [purpose, setPurpose] = useState(account?.purpose ?? "")
  const [iban, setIban] = useState(account?.iban ?? "")
  const [ownerIds, setOwnerIds] = useState<string[]>(account?.ownerIds ?? [])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  // Inline bank creation
  const [showNewBank, setShowNewBank] = useState(false)
  const [newBankName, setNewBankName] = useState("")
  const [newBankColor, setNewBankColor] = useState(BANK_COLORS[0])
  const [creatingBank, setCreatingBank] = useState(false)

  function toggleOwner(id: string) {
    setOwnerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleCreateBank() {
    if (!newBankName.trim()) return
    setCreatingBank(true)
    try {
      const res = await fetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBankName.trim(), colorHex: newBankColor }),
      })
      if (!res.ok) { setError("Erreur création banque."); return }
      const json = (await res.json()) as { data: Bank }
      const newBank = json.data
      onBankCreated?.(newBank)
      setBankId(newBank.id)
      setNewBankName("")
      setShowNewBank(false)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setCreatingBank(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Le nom est requis."); return }
    setLoading(true)
    setError("")
    try {
      const balanceCents = balance ? Math.round(parseFloat(balance.replace(",", ".")) * 100) : 0
      const payload = {
        name: name.trim(),
        type,
        bankId: bankId || null,
        balanceCents: isNaN(balanceCents) ? 0 : balanceCents,
        iban: iban.trim() || null,
        currency,
        last4: last4.trim(),
        purpose: purpose.trim(),
        ownerIds,
      }

      let raw: Account
      if (isEdit) {
        const res = await fetch(`/api/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { setError("Erreur lors de la mise à jour."); return }
        const json = (await res.json()) as { data: Account }
        raw = json.data
      } else {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
        const json = (await res.json()) as { data: Account }
        raw = json.data
      }

      const parsedOwnerIds: string[] = JSON.parse(raw.ownerIds as unknown as string)
      const memberMap = new Map(members.map((m) => [m.id, m.name]))
      const enriched: Omit<EnrichedAccount, "balanceBaseCents"> = {
        ...raw,
        ownerIds: parsedOwnerIds,
        ownerNames: parsedOwnerIds.map((id) => memberMap.get(id) ?? id),
      }
      onSaved(enriched)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!account) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" })
      if (res.ok) onDeleted?.(account.id)
      else setError("Erreur lors de la suppression.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setDeleting(false)
    }
  }

  const allBanks = banks

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le compte" : "Nouveau compte bancaire"}</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} type="button" onClick={onClose} aria-label="Fermer"><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            <div className="field-row">
              <div className="field">
                <label htmlFor="acct-bank">Banque</label>
                {!showNewBank ? (
                  <select id="acct-bank" value={bankId} onChange={(e) => e.target.value === "__new" ? setShowNewBank(true) : setBankId(e.target.value)}>
                    <option value="">Sans banque</option>
                    {allBanks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    <option value="__new">+ Nouvelle banque…</option>
                  </select>
                ) : (
                  <div className="new-bank-form">
                    <input type="text" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="ex. BNP Paribas" autoFocus />
                    <div className="new-bank-colors">
                      {BANK_COLORS.map((c) => (
                        <button key={c} type="button" className={`swatch${newBankColor === c ? " on" : ""}`} style={{ background: c, width: 20, height: 20 }} onClick={() => setNewBankColor(c)} aria-label={c} />
                      ))}
                    </div>
                    <div className="new-bank-actions">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowNewBank(false)}>Annuler</button>
                      <button type="button" className="btn btn-sm btn-primary" onClick={handleCreateBank} disabled={creatingBank || !newBankName.trim()}>{creatingBank ? "Création…" : "Créer"}</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="field">
                <label htmlFor="acct-type">Type</label>
                <select id="acct-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="acct-name">Nom du compte</label>
                <input id="acct-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Compte joint" required autoFocus />
              </div>
              <div className="field">
                <label htmlFor="acct-last4">4 derniers chiffres</label>
                <input id="acct-last4" type="text" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} placeholder="4412" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="acct-purpose">Fonction du compte</label>
              <input id="acct-purpose" type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="ex. Courses & quotidien, Prêts & charges…" />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="acct-balance">{isEdit ? "Solde actuel" : "Solde initial"}</label>
                <div className="field-amount">
                  <input id="acct-balance" type="text" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0,00" />
                  <span className="cur">{currencySym(currency)}</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="acct-cur">Devise du compte</label>
                <select id="acct-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {Object.entries(CURRENCIES).map(([k, c]) => <option key={k} value={k}>{k} — {c.name} ({c.sym}){k === getBaseCurrency() ? " · devise du foyer" : ""}</option>)}
                </select>
                <div className="field-hint">Par défaut : devise de référence du foyer (Paramètres). Modifiable pour ce compte.</div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="acct-iban">IBAN <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optionnel)</span></label>
              <input id="acct-iban" type="text" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" />
            </div>
            {members.length > 0 && (
              <div className="field">
                <label>Titulaire(s)</label>
                <div className="owner-picker">
                  {members.map((m) => (
                    <button key={m.id} type="button" className={`owner-opt${ownerIds.includes(m.id) ? " on" : ""}`} onClick={() => toggleOwner(m.id)}>
                      <span className="mini-av" style={{ background: `${m.colorHex}22`, color: m.colorHex, borderColor: `${m.colorHex}55`, width: 24, height: 24, fontSize: 10 }}>{initials(m.name)}</span>
                      {m.short}
                    </button>
                  ))}
                </div>
                <div className="field-hint">Deux titulaires ou plus → compte partagé du foyer.</div>
              </div>
            )}
          </div>
          <div className="modal-foot">
            {isEdit && (
              <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "#D85A30" }} onClick={handleDelete} disabled={deleting || loading}>
                <i className="ti ti-trash" /> {deleting ? "Suppression…" : "Supprimer"}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}><i className="ti ti-check" /> {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le compte"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
