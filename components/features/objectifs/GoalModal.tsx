"use client"
import { useEffect, useState } from "react"
import type { Goal, Transaction } from "@/db/schema"
import { grow } from "@/lib/finance/amort"
import { eur } from "@/lib/finance/format"
import { formatCents } from "@/lib/money"
import { MiniAv } from "@/components/features/finance/ui"

export type GoalWithPockets = Goal & { pockets: { accountId: string; pct: number }[]; baseCents?: number }
export type AccountRow = { id: string; name: string; bankName: string | null; balanceCents: number }
export type MemberRow = { id: string; name: string; short: string; isChild: boolean; colorHex?: string }

const RISKS = [
  { value: "prudent", label: "Prudent — 2,5 %/an", r: 2.5 },
  { value: "equilibre", label: "Équilibré — 4,5 %/an", r: 4.5 },
  { value: "dynamique", label: "Dynamique — 6,5 %/an", r: 6.5 },
]
const num = (v: string) => parseFloat(v.replace(/\s/g, "").replace(",", ".")) || 0
const parseIds = (s: string | undefined): string[] => { try { const v = JSON.parse(s ?? "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }
const monthsUntil = (ym: string): number => {
  if (!ym) return 0
  const [y, m] = ym.split("-").map(Number)
  const n = new Date()
  return Math.max(0, (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth()))
}
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const dateFr = (d: string) => { const [y, m, dd] = d.split("-"); return `${+dd} ${MONTHS[+m - 1]} ${y}` }

interface Props {
  goal: GoalWithPockets | null
  accounts: AccountRow[]
  members: MemberRow[]
  onClose: () => void
  onSaved: (g: GoalWithPockets) => void
  onDeleted: (id: string) => void
}

export function GoalModal({ goal, accounts, members, onClose, onSaved, onDeleted }: Props) {
  const isEdit = goal !== null
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯")
  const [name, setName] = useState(goal?.name ?? "")
  const [description, setDesc] = useState(goal?.description ?? "")
  const [target, setTarget] = useState(goal ? String(Math.round(goal.targetCents / 100)) : "")
  const [deadline, setDeadline] = useState(goal?.deadline?.slice(0, 7) ?? "")
  const [linkedAccountId, setLinked] = useState(goal?.linkedAccountId ?? "")
  const [memberId, setMemberId] = useState(goal?.memberId ?? "")
  const [current, setCurrent] = useState(goal ? String(Math.round((goal.baseCents ?? goal.currentCents) / 100)) : "")
  const [monthly, setMonthly] = useState(goal?.monthlyCents != null ? String(goal.monthlyCents / 100) : "")
  const [risk, setRisk] = useState(goal?.risk ?? "equilibre")
  const [owners, setOwners] = useState<string[]>(parseIds(goal?.ownerIds))
  const [pockets, setPockets] = useState<Record<string, number>>(Object.fromEntries((goal?.pockets ?? []).map((p) => [p.accountId, p.pct])))
  const [txs, setTxs] = useState<Transaction[]>([])
  const [linkId, setLinkId] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const loadTx = async () => {
    if (!goal) return
    try {
      const res = await fetch("/api/transactions")
      if (res.ok) setTxs(((await res.json()) as { data: Transaction[] }).data)
    } catch { /* liste facultative */ }
  }
  useEffect(() => { void loadTx() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const picked = Object.keys(pockets)
  const pocketsValue = picked.reduce((s, id) => s + ((accounts.find((a) => a.id === id)?.balanceCents ?? 0) / 100) * ((pockets[id] ?? 100) / 100), 0)
  const currentEur = picked.length ? pocketsValue : num(current)
  const months = monthsUntil(deadline)
  const rate = RISKS.find((r) => r.value === risk)?.r ?? 4.5
  const targetEur = num(target)
  const need = months ? Math.max(0, (targetEur - grow(currentEur, 0, months / 12, rate)) / months) : Math.max(0, targetEur - currentEur)
  const linked = txs.filter((t) => goal && t.goalId === goal.id)
  const candidates = txs.filter((t) => !t.goalId).slice(0, 30)
  const adults = members.filter((m) => !m.isChild)
  const children = members.filter((m) => m.isChild)

  const togglePocket = (id: string) => setPockets((p) => { if (p[id] !== undefined) { const n = { ...p }; delete n[id]; return n } return { ...p, [id]: 100 } })
  const setPct = (id: string, v: string) => setPockets((p) => ({ ...p, [id]: Math.min(100, Math.max(1, parseInt(v, 10) || 100)) }))
  const toggleOwner = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  async function setLink(txId: string, goalId: string | null) {
    await fetch(`/api/transactions/${txId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goalId }) })
    setLinkId("")
    await loadTx()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || targetEur <= 0) { setError("Intitulé et montant à réunir sont requis."); return }
    setLoading(true); setError("")
    try {
      const keepDay = goal?.deadline && goal.deadline.slice(0, 7) === deadline ? goal.deadline : deadline ? `${deadline}-01` : null
      const payload = {
        name: name.trim(), emoji, description, targetCents: Math.round(targetEur * 100),
        currentCents: picked.length ? goal?.baseCents ?? 0 : Math.round(num(current) * 100),
        deadline: keepDay, linkedAccountId: linkedAccountId || null, memberId: memberId || null,
        monthlyCents: monthly.trim() ? Math.round(num(monthly) * 100) : null, risk, ownerIds: owners,
        pockets: Object.entries(pockets).map(([accountId, pct]) => ({ accountId, pct })),
      }
      const res = await fetch(isEdit ? `/api/goals/${goal.id}` : "/api/goals", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      onSaved(((await res.json()) as { data: GoalWithPockets }).data)
    } catch { setError("Erreur réseau.") } finally { setLoading(false) }
  }

  async function handleDelete() {
    if (!goal) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" })
      if (res.ok) onDeleted(goal.id); else setError("Erreur lors de la suppression.")
    } catch { setError("Erreur réseau.") } finally { setDeleting(false) }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>{isEdit ? `${goal.emoji} ${goal.name}` : "Nouvel objectif"}</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}
            <div className="field-row">
              <div className="field" style={{ flex: "0 0 92px" }}><label>Emoji</label><input type="text" maxLength={4} value={emoji} onChange={(e) => setEmoji(e.target.value)} /></div>
              <div className="field"><label>Intitulé</label><input type="text" placeholder="ex. Apport maison familiale" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></div>
              <div className="field"><label>Précision</label><input type="text" placeholder="ex. Résidence principale plus grande" value={description} onChange={(e) => setDesc(e.target.value)} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Montant à réunir</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="80 000" value={target} onChange={(e) => setTarget(e.target.value)} required /><span className="cur">€</span></div></div>
              <div className="field"><label>Échéance</label><input type="month" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Compte hébergeur <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(objectif à court terme)</span></label>
              <select value={linkedAccountId} onChange={(e) => setLinked(e.target.value)}>
                <option value="">Aucun compte hébergeur</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName ? `${a.bankName} · ` : ""}{a.name} — {formatCents(a.balanceCents)}</option>)}
              </select>
              <div className="field-hint">Le compte dans lequel l&apos;argent est réellement posé ; les transactions liées viennent s&apos;y imputer.</div>
            </div>
            <div className="field">
              <label>Poches adossées <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(objectif à long terme)</span></label>
              <div className="src-picker">
                {accounts.length === 0 && <div className="field-hint" style={{ padding: 10 }}>Aucun compte disponible.</div>}
                {accounts.map((a) => {
                  const on = pockets[a.id] !== undefined
                  return (
                    <div key={a.id} className={`src-line ${on ? "on" : ""}`}>
                      <button type="button" className="src-tog" onClick={() => togglePocket(a.id)}><i aria-hidden="true" className={`ti ${on ? "ti-checkbox" : "ti-square"}`} /><span>{a.bankName ? `${a.bankName} · ` : ""}{a.name}</span></button>
                      <b className="num private">{eur(a.balanceCents / 100)}</b>
                      <input className="src-share" type="text" inputMode="numeric" disabled={!on} value={on ? pockets[a.id] : 100} onChange={(e) => setPct(a.id, e.target.value)} /><span className="src-pc">%</span>
                    </div>
                  )
                })}
              </div>
              <div className="field-hint">
                {picked.length
                  ? <>{picked.length} poche{picked.length > 1 ? "s" : ""} adossée{picked.length > 1 ? "s" : ""} · <b>{eur(pocketsValue)}</b> constitués</>
                  : "Aucune poche : l'objectif fonctionne en compartiment — montant suivi à la main dans le compte hébergeur."}
              </div>
            </div>
            <div className="field-row">
              {!picked.length && (
                <div className="field"><label>Montant déjà constitué</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="24 800" value={current} onChange={(e) => setCurrent(e.target.value)} /><span className="cur">€</span></div>
                  <div className="field-hint">Utilisé seulement si aucune poche n&apos;est adossée.</div></div>
              )}
              <div className="field"><label>Effort mensuel</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="calculé" value={monthly} onChange={(e) => setMonthly(e.target.value)} /><span className="cur">€</span></div>
                <div className="field-hint">{monthly.trim() ? "Effort saisi." : `Laisser vide pour utiliser le calcul : ${eur(need)}/mois pour tenir l'échéance.`}</div></div>
            </div>
            <div className="field"><label>Placement adossé au projet</label>
              <select value={risk} onChange={(e) => setRisk(e.target.value)}>{RISKS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
              <div className="field-hint">Un horizon inférieur à 5 ans justifie un support prudent : la volatilité pèse davantage que le rendement.</div></div>
            <div className="field"><label>Concerne</label>
              <div className="owner-picker">
                {adults.map((m) => (
                  <button key={m.id} type="button" className={`owner-opt${owners.includes(m.id) ? " on" : ""}`} onClick={() => toggleOwner(m.id)}>
                    <MiniAv m={{ id: m.id, name: m.name, short: m.short, role: "", color: m.colorHex ?? "#888780", incomeMonthly: 0, birthYear: null, isChild: false }} size={24} /> {m.short}
                  </button>
                ))}
              </div>
            </div>
            {children.length > 0 && (
              <div className="field"><label>Assigner à un enfant <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optionnel)</span></label>
                <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">Objectif du foyer</option>
                  {children.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select></div>
            )}
            {isEdit && (
              <div>
                <div className="divider" style={{ margin: "16px 0" }} />
                <div className="env-tx-head"><span className="card-title" style={{ fontSize: 13 }}>Transactions liées</span>
                  <span className="num private" style={{ fontSize: 12.5, color: "var(--fg-secondary)" }}>{eur(linked.reduce((s, t) => s + Math.abs(t.amountCents) / 100, 0))}</span></div>
                {linked.length ? (
                  <div className="env-tx-list">
                    {linked.map((t) => (
                      <div className="env-tx-row" key={t.id}>
                        <span className="env-tx-info"><span className="env-tx-name">{t.name}</span><span className="env-tx-sub">{dateFr(t.date)}{t.note ? ` · ${t.note}` : ""}</span></span>
                        <span className={`num private env-tx-amt ${t.amountCents >= 0 ? "pos" : "neg"}`}>{t.amountCents >= 0 ? "+" : "−"}{formatCents(Math.abs(t.amountCents))}</span>
                        <button type="button" className="rec-act" title="Délier" onClick={() => void setLink(t.id, null)}><i aria-hidden="true" className="ti ti-link-off" /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="detect-empty"><i aria-hidden="true" className="ti ti-inbox" /> Aucune transaction liée pour l&apos;instant.</div>}
                <div className="field" style={{ marginTop: 12 }}><label>Lier une transaction</label>
                  <div className="env-link-row">
                    <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                      <option value="">Choisir une opération…</option>
                      {candidates.map((t) => <option key={t.id} value={t.id}>{dateFr(t.date)} · {t.name} · {t.amountCents >= 0 ? "+" : "−"}{formatCents(Math.abs(t.amountCents))}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost" disabled={!linkId} onClick={() => void setLink(linkId, goal.id)}><i aria-hidden="true" className="ti ti-link" /> Lier</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="modal-foot">
            {isEdit && <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "#D85A30" }} onClick={handleDelete} disabled={deleting}><i aria-hidden="true" className="ti ti-trash" /> {deleting ? "Suppression…" : "Supprimer"}</button>}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}><i aria-hidden="true" className="ti ti-check" /> {loading ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
