"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import type { EnrichedAccount, Member, Bank } from "./types"
import type { Account } from "@/db/schema"

const TYPE_OPTIONS = [
  { value: "checking", label: "Courant" },
  { value: "savings", label: "Épargne" },
  { value: "investment", label: "Investissement" },
  { value: "other", label: "Autre" },
] as const

interface Props {
  members: Member[]
  banks: Bank[]
  onClose: () => void
  onSaved: (account: EnrichedAccount) => void
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

export function AccountModal({ members, banks, onClose, onSaved }: Props) {
  const [name, setName] = useState("")
  const [type, setType] = useState<"checking" | "savings" | "investment" | "other">("checking")
  const [bankId, setBankId] = useState(banks[0]?.id ?? "")
  const [balance, setBalance] = useState("")
  const [iban, setIban] = useState("")
  const [ownerIds, setOwnerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function toggleOwner(id: string) {
    setOwnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Le nom est requis.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const balanceCents = balance
        ? Math.round(parseFloat(balance.replace(",", ".")) * 100)
        : 0
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          bankId: bankId || null,
          balanceCents: isNaN(balanceCents) ? 0 : balanceCents,
          iban: iban.trim() || null,
          ownerIds,
        }),
      })
      const json = (await res.json()) as { data: Account }
      if (!res.ok) {
        setError("Erreur lors de l'enregistrement.")
        return
      }
      // Enrich the raw account
      const raw = json.data
      const parsedOwnerIds: string[] = JSON.parse(raw.ownerIds)
      const memberMap = new Map(members.map((m) => [m.id, m.name]))
      const enriched: EnrichedAccount = {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nouveau compte</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--fg-secondary)" }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="acct-name">Nom</label>
              <input
                id="acct-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Compte courant BNP"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="acct-type">Type</label>
              <select
                id="acct-type"
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value as "checking" | "savings" | "investment" | "other"
                  )
                }
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", fontSize: "14px", color: "var(--fg)" }}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {banks.length > 0 && (
              <div className="field">
                <label htmlFor="acct-bank">Banque</label>
                <select
                  id="acct-bank"
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", fontSize: "14px", color: "var(--fg)" }}
                >
                  <option value="">Sans banque</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="acct-balance">Solde initial (€)</label>
              <input
                id="acct-balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="field">
              <label htmlFor="acct-iban">IBAN (optionnel)</label>
              <input
                id="acct-iban"
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
              />
            </div>
            {members.length > 0 && (
              <div className="field">
                <label>Titulaires</label>
                <div className="owner-opts">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`owner-opt${ownerIds.includes(m.id) ? " on" : ""}`}
                      onClick={() => toggleOwner(m.id)}
                    >
                      <span
                        className="mini-av"
                        style={{
                          background: `${m.colorHex}22`,
                          color: m.colorHex,
                          borderColor: `${m.colorHex}55`,
                          width: "22px",
                          height: "22px",
                          fontSize: "9px",
                        }}
                      >
                        {initials(m.name)}
                      </span>
                      {m.short}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <div className="err on">{error}</div>}
          </div>
          <div className="modal-footer">
            <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Enregistrement…" : "Créer le compte"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
