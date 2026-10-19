"use client"
import { currencySym, getBaseCurrency } from "@/lib/finance/fx"
import { useState } from "react"
import { formatCents } from "@/lib/money"
import type { Transaction, Account, Category, Goal, Project, Member } from "@/db/schema"

interface Props {
  editingTx: Transaction | null
  accounts: Account[]
  categories: Category[]
  goals: Goal[]
  projects: Project[]
  members: Member[]
  onSaved: (tx: Transaction) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

type TxKind = "expense" | "income" | "transfer"

const centsToEurStr = (cents: number) => (Math.abs(cents) / 100).toFixed(2).replace(".", ",")
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const dateLabel = (d: string) => { const [, m, day] = d.split("-").map(Number); return `${day} ${MONTHS[m - 1] ?? ""}` }

export function TransactionModal({ editingTx, accounts, categories, goals, projects, members, onSaved, onDeleted, onClose }: Props) {
  const isEdit = editingTx !== null
  const today = new Date().toISOString().slice(0, 10)
  const initType: TxKind = editingTx?.kind === "transfer" ? "transfer" : editingTx && editingTx.amountCents > 0 ? "income" : "expense"

  const [name, setName] = useState(editingTx?.name ?? "")
  const [amount, setAmount] = useState(editingTx ? centsToEurStr(editingTx.originalCents ?? editingTx.amountCents) : "")
  const [txType, setTxType] = useState<TxKind>(initType)
  const [date, setDate] = useState(editingTx?.date ?? today)
  const [accountId, setAccountId] = useState(editingTx?.accountId ?? accounts[0]?.id ?? "")
  const [toAccountId, setToAccountId] = useState(editingTx?.toAccountId ?? "")
  const [categoryId, setCategoryId] = useState(editingTx?.categoryId ?? "")
  const [memberId, setMemberId] = useState(editingTx?.memberId ?? "")
  const [isCommon, setIsCommon] = useState(editingTx?.isCommon ?? true)
  const [goalId, setGoalId] = useState(editingTx?.goalId ?? "")
  const [projectId, setProjectId] = useState(editingTx?.projectId ?? "")
  const [note, setNote] = useState(editingTx?.note ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const accCur = accounts.find((a) => a.id === accountId)?.currency || getBaseCurrency()
  const isTransfer = txType === "transfer"
  const adults = members.filter((m) => !m.isChild)
  const cat = categories.find((c) => c.id === editingTx?.categoryId)
  const acct = accounts.find((a) => a.id === editingTx?.accountId)

  function parseAmountCents(): number {
    const abs = Math.round(parseFloat(amount.replace(/\s/g, "").replace(",", ".")) * 100)
    if (isNaN(abs)) return 0
    if (isTransfer) return abs
    return txType === "expense" ? -abs : abs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Le libellé est requis."); return }
    if (!amount.trim()) { setError("Le montant est requis."); return }
    if (!date) { setError("La date est requise."); return }
    if (isTransfer && !toAccountId) { setError("Le compte destinataire est requis."); return }
    setLoading(true)
    setError("")
    try {
      const body = {
        name: name.trim(), amountCents: parseAmountCents(), date,
        accountId: accountId || null,
        categoryId: isTransfer ? null : categoryId || null,
        note: note.trim(), kind: txType,
        toAccountId: isTransfer ? toAccountId || null : null,
        goalId: goalId || null, projectId: projectId || null,
        memberId: memberId || null, isCommon: isTransfer ? true : isCommon,
      }
      const res = await fetch(isEdit ? `/api/transactions/${editingTx.id}` : "/api/transactions", {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      onSaved(((await res.json()) as { data: Transaction }).data)
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
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal${isEdit ? " modal-md" : ""}`}>
        <div className="modal-head">
          <h3>{isEdit ? "Détail de l'opération" : "Nouvelle transaction"}</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}

            {isEdit && editingTx && (
              <div className="txm-head">
                <div className="tx-icon" style={{ background: `${cat?.colorHex ?? "#888780"}22`, color: cat?.colorHex ?? "#888780" }}><i aria-hidden="true" className={`ti ${cat?.icon ?? (isTransfer ? "ti-arrows-exchange" : "ti-tag")}`} /></div>
                <div className="txm-head-info">
                  <div className="txm-head-name">{editingTx.name}</div>
                  <div className="txm-head-sub">{dateLabel(editingTx.date)}{acct ? ` · ${acct.name}` : ""}</div>
                </div>
                <div className={`txm-head-amt num ${editingTx.amountCents >= 0 ? "pos" : "neg"}`}>{editingTx.amountCents >= 0 ? "+" : ""}{formatCents(editingTx.amountCents)}</div>
              </div>
            )}

            <div className="type-toggle">
              <button type="button" className={`type-opt exp${txType === "expense" ? " active" : ""}`} onClick={() => setTxType("expense")}><i aria-hidden="true" className="ti ti-arrow-up-right" /> Dépense</button>
              <button type="button" className={`type-opt inc${txType === "income" ? " active" : ""}`} onClick={() => setTxType("income")}><i aria-hidden="true" className="ti ti-arrow-down-left" /> Revenu</button>
              <button type="button" className={`type-opt${txType === "transfer" ? " active" : ""}`} onClick={() => setTxType("transfer")}><i aria-hidden="true" className="ti ti-arrows-exchange" /> Transfert</button>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="tx-name">Libellé</label>
                <input id="tx-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Carrefour, Loyer, Netflix…" required />
              </div>
              <div className="field">
                <label htmlFor="tx-amt">Montant{accCur !== getBaseCurrency() ? ` (${accCur})` : ""}</label>
                <div className="field-amount">
                  <input id="tx-amt" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
                  <span className="cur">{currencySym(accCur)}</span>
                </div>
              </div>
            </div>

            <div className="field-row">
              {isTransfer ? (
                <div className="field">
                  <label htmlFor="tx-to-account">Compte destinataire</label>
                  <select id="tx-to-account" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} required>
                    <option value="">— Choisir —</option>
                    {accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}{a.type === "savings" ? " 💰" : ""}</option>)}
                  </select>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="tx-cat">Catégorie</label>
                  <select id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">— Aucune —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="tx-date">Date</label>
                <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="tx-account">{isTransfer ? "Compte source" : "Compte"}</label>
                <select id="tx-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {!isTransfer && (
                <div className="field">
                  <label htmlFor="tx-payer">Attribué à</label>
                  <select id="tx-payer" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">— Non attribué —</option>
                    {adults.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {!isTransfer && (
              <div className="field">
                <label>Type de dépense</label>
                <div className="type-toggle">
                  <button type="button" className={`type-opt${!isCommon ? " active" : ""}`} onClick={() => setIsCommon(false)}><i aria-hidden="true" className="ti ti-user" /> Personnelle</button>
                  <button type="button" className={`type-opt${isCommon ? " active" : ""}`} onClick={() => setIsCommon(true)}><i aria-hidden="true" className="ti ti-users" /> Commune au foyer</button>
                </div>
              </div>
            )}

            <div className="field-row">
              <div className="field">
                <label htmlFor="tx-goal">Enveloppe</label>
                <select id="tx-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                  <option value="">— Aucune —</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tx-note">Note {!isEdit && <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optionnel)</span>}</label>
                <input id="tx-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note…" />
              </div>
            </div>

            {isTransfer && projects.length > 0 && (
              <div className="field">
                <label htmlFor="tx-project">Projet (optionnel)</label>
                <select id="tx-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">— Aucun —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="modal-foot">
            {isEdit && (
              <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "#D85A30" }} onClick={() => void handleDelete()} disabled={loading}>
                <i aria-hidden="true" className="ti ti-trash" /> Supprimer
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}><i aria-hidden="true" className="ti ti-check" /> {loading ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
