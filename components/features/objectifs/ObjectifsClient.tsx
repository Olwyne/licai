"use client"
import { useState, useEffect, useCallback } from "react"
import { Chip } from "@/components/ui/Chip"
import { formatCents } from "@/lib/money"
import { goalOutlook } from "@/lib/finance/alerts-engine"
import type { Goal } from "@/db/schema"

import { GoalModal, type GoalWithPockets, type AccountRow, type MemberRow } from "./GoalModal"

// ─── helpers ────────────────────────────────────────────────────────────────

function deadlineLabel(deadline: string | null): string {
  if (!deadline) return "Sans échéance"
  const d = new Date(deadline)
  return `Échéance : ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
}

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  return Math.round((new Date(deadline).getTime() - Date.now()) / 86400000)
}

type FilterMode = "tous" | "court" | "long" | "risque" | "atteints"
const FILTERS: { value: FilterMode; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "court", label: "Court terme" },
  { value: "long", label: "Long terme" },
  { value: "risque", label: "À risque" },
  { value: "atteints", label: "Atteints" },
]

const PRESET_COLORS = ["#1D9E75", "#378ADD", "#7C6BD6", "#D4537E", "#EF9F27", "#D85A30"]

// ─── AddFundsModal ────────────────────────────────────────────────────────────

interface AddFundsModalProps {
  goal: GoalWithPockets
  onClose: () => void
  onSaved: (g: GoalWithPockets) => void
}

function AddFundsModal({ goal, onClose, onSaved }: AddFundsModalProps) {
  const [amountEuros, setAmountEuros] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amountEuros.replace(",", "."))
    if (isNaN(parsed) || parsed <= 0) {
      setError("Montant invalide.")
      return
    }
    const addedCents = Math.round(parsed * 100)
    const newCurrentCents = goal.currentCents + addedCents
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentCents: newCurrentCents }),
      })
      if (!res.ok) { setError("Erreur lors de la mise à jour."); return }
      const json = (await res.json()) as { data: GoalWithPockets }
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
          <h2 className="modal-title">Ajouter des fonds — {goal.name}</h2>
          <button className="modal-close" onClick={onClose} type="button">
            <i className="ti ti-x" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="add-funds-amount">Montant à ajouter (€)</label>
            <input
              id="add-funds-amount"
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              value={amountEuros}
              onChange={(e) => setAmountEuros(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <p className="obj-modal-err">{error}</p>}
          <div className="obj-modal-foot">
            <div className="obj-modal-foot-right">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: GoalWithPockets
  onEdit: (g: GoalWithPockets) => void
  onAddFunds: (g: GoalWithPockets) => void
}

function GoalCard({ goal, onEdit, onAddFunds }: GoalCardProps) {
  const pct = goal.targetCents > 0
    ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100))
    : 0
  const isAtteint = goal.currentCents >= goal.targetCents
  const days = daysUntil(goal.deadline)
  const reste = Math.max(0, goal.targetCents - goal.currentCents)
  const months = days !== null && days > 0 ? Math.max(1, Math.round(days / 30)) : null
  const effortMensuel = months ? Math.round(reste / months) : null

  // Probabilité heuristique: high if pct >= expected pct at this point in time
  let probabilite: number | null = null
  if (goal.deadline && days !== null && days > 0) {
    const totalDays = (new Date(goal.deadline).getTime() - (Date.now() - days * 86400000)) / 86400000
    const expectedPct = totalDays > 0 ? Math.round(((totalDays - days) / totalDays) * 100) : 0
    const lead = pct - expectedPct
    probabilite = Math.min(100, Math.max(0, 50 + lead * 2))
  }

  const outlook = goal.deadline && goal.monthlyCents != null && days !== null && days > 0
    ? goalOutlook({ id: goal.id, name: goal.name, current: goal.currentCents / 100, target: goal.targetCents / 100, deadline: goal.deadline, risk: goal.risk, monthly: goal.monthlyCents / 100 }, new Date().toISOString().slice(0, 10))
    : null
  if (outlook) probabilite = Math.round(outlook.prob * 100)

  const kindLabel = goal.kind === "court" ? "COURT TERME" : "LONG TERME"
  const kindColor = goal.kind === "court" ? "#378ADD" : "#7C6BD6"

  return (
    <div className="goal-card clickable" onClick={() => onEdit(goal)}>
      <div className="goal-top">
        <div className="goal-emoji" style={{ background: goal.colorHex + "22" }}>
          {goal.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div className="goal-name">{goal.name}</div>
            <span className="goal-kind-badge" style={{ background: kindColor + "22", color: kindColor }}>
              {kindLabel}
            </span>
          </div>
          <div className="goal-deadline">{deadlineLabel(goal.deadline)}</div>
        </div>
      </div>

      <div className="goal-amounts">
        <span className="goal-current">{formatCents(goal.currentCents)}</span>
        <span className="goal-target">/ {formatCents(goal.targetCents)}</span>
      </div>

      <div className="goal-bar">
        <div style={{ width: `${pct}%`, background: goal.colorHex }} />
      </div>

      <div className="goal-foot">
        <span className="goal-pct"><b>{pct} %</b> atteint</span>
        <button
          className="goal-add"
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddFunds(goal) }}
        >
          <i className="ti ti-plus icon-sm" />
          Ajouter
        </button>
      </div>

      {/* Stats row */}
      {!isAtteint && (
        <div className="goal-stats">
          {outlook && (
            <div className="goal-stat">
              <span className="goal-stat-label">Projeté à l&apos;échéance</span>
              <span className="goal-stat-val">{formatCents(Math.round(outlook.proj * 100))}</span>
            </div>
          )}
          {outlook && (
            <div className="goal-stat">
              <span className="goal-stat-label">Effort requis</span>
              <span className="goal-stat-val">{formatCents(Math.round(outlook.need * 100))}</span>
            </div>
          )}
          {effortMensuel !== null && (
            <div className="goal-stat">
              <span className="goal-stat-label">Effort mensuel</span>
              <span className="goal-stat-val">{formatCents(effortMensuel)}</span>
            </div>
          )}
          {days !== null && (
            <div className="goal-stat">
              <span className="goal-stat-label">Jours restants</span>
              <span className={`goal-stat-val${days < 30 ? " danger" : days < 90 ? " warn" : ""}`}>
                {days > 0 ? days : "Dépassé"}
              </span>
            </div>
          )}
          {probabilite !== null && (
            <div className="goal-stat">
              <span className="goal-stat-label">Probabilité</span>
              <span className={`goal-stat-val${probabilite >= 70 ? " ok" : probabilite >= 40 ? " warn" : " danger"}`}>
                {probabilite} %
              </span>
            </div>
          )}
          <div className="goal-stat">
            <span className="goal-stat-label">Reste</span>
            <span className="goal-stat-val">{formatCents(reste)}</span>
          </div>
        </div>
      )}

      {isAtteint && (
        <div className="goal-atteint">
          <i className="ti ti-circle-check" /> Objectif atteint !
        </div>
      )}
    </div>
  )
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function KpiRow({ goalList }: { goalList: Goal[] }) {
  const totalTarget  = goalList.reduce((s, g) => s + g.targetCents, 0)
  const totalCurrent = goalList.reduce((s, g) => s + g.currentCents, 0)
  const resteARéunir = Math.max(0, totalTarget - totalCurrent)

  // Effort mensuel: sum of (reste / mois restants) for goals with deadline
  const effortMensuelCents = goalList.reduce((s, g) => {
    if (!g.deadline || g.currentCents >= g.targetCents) return s
    const days = daysUntil(g.deadline)
    if (!days || days <= 0) return s
    const months = Math.max(1, Math.round(days / 30))
    return s + Math.round((g.targetCents - g.currentCents) / months)
  }, 0)

  const aRisque = goalList.filter((g) => {
    const d = daysUntil(g.deadline)
    const pct = g.targetCents > 0 ? g.currentCents / g.targetCents : 1
    return d !== null && d < 90 && pct < 0.8 && g.currentCents < g.targetCents
  }).length

  return (
    <div className="metrics" style={{ marginBottom: 20 }}>
      <div className="metric">
        <div className="metric-top">
          <span className="metric-label">Constitué</span>
          <span className="metric-ic" style={{ background: "#1D9E7520" }}>
            <i className="ti ti-pig-money" style={{ color: "#1D9E75" }} />
          </span>
        </div>
        <div className="metric-value">{formatCents(totalCurrent)}</div>
        <div className="metric-sub neutral">sur {formatCents(totalTarget)}</div>
      </div>
      <div className="metric">
        <div className="metric-top">
          <span className="metric-label">Reste à réunir</span>
          <span className="metric-ic" style={{ background: "#6366F120" }}>
            <i className="ti ti-target" style={{ color: "#6366F1" }} />
          </span>
        </div>
        <div className="metric-value">{formatCents(resteARéunir)}</div>
        <div className="metric-sub neutral">{goalList.length} objectif{goalList.length !== 1 ? "s" : ""}</div>
      </div>
      <div className="metric">
        <div className="metric-top">
          <span className="metric-label">Effort mensuel</span>
          <span className="metric-ic" style={{ background: "#EF9F2720" }}>
            <i className="ti ti-calendar-month" style={{ color: "#EF9F27" }} />
          </span>
        </div>
        <div className="metric-value">{formatCents(effortMensuelCents)}</div>
        <div className="metric-sub neutral">Pour tenir les échéances</div>
      </div>
      <div className="metric">
        <div className="metric-top">
          <span className="metric-label">Objectifs à risque</span>
          <span className="metric-ic" style={{ background: aRisque > 0 ? "#D85A3020" : "#1D9E7520" }}>
            <i className="ti ti-alert-triangle" style={{ color: aRisque > 0 ? "#D85A30" : "#1D9E75" }} />
          </span>
        </div>
        <div className="metric-value" style={{ color: aRisque > 0 ? "var(--danger)" : undefined }}>
          {aRisque}
        </div>
        <div className="metric-sub neutral">{aRisque > 0 ? "Trajectoire compromise" : "Tout est sur la bonne voie"}</div>
      </div>
    </div>
  )
}

// ─── Main client component ───────────────────────────────────────────────────

export default function ObjectifsClient() {
  const [goalList, setGoalList]   = useState<GoalWithPockets[]>([])
  const [accounts, setAccounts]   = useState<AccountRow[]>([])
  const [members, setMembers]     = useState<MemberRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState("")
  const [filter, setFilter]       = useState<FilterMode>("tous")
  const [modalGoal, setModalGoal] = useState<GoalWithPockets | null | "new">(null)
  const [addFundsGoal, setAddFundsGoal] = useState<GoalWithPockets | null>(null)

  const load = useCallback(async () => {
    try {
      const [gRes, aRes, mRes] = await Promise.all([fetch("/api/goals"), fetch("/api/accounts"), fetch("/api/members")])
      if (gRes.ok) {
        const json = (await gRes.json()) as { data: GoalWithPockets[] }
        setGoalList(json.data)
      } else {
        setLoadError("Impossible de charger les objectifs.")
      }
      if (aRes.ok) {
        const aJson = (await aRes.json()) as { data: AccountRow[] }
        setAccounts(aJson.data.map((a) => ({ ...a, balanceCents: (a as AccountRow & { balanceBaseCents?: number }).balanceBaseCents ?? a.balanceCents })))
      }
      if (mRes.ok) {
        const mJson = (await mRes.json()) as { data: MemberRow[] }
        setMembers(mJson.data)
      }
    } catch {
      setLoadError("Erreur réseau. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = goalList.filter((g) => {
    if (filter === "court") return g.kind === "court"
    if (filter === "long") return g.kind === "long"
    if (filter === "atteints") return g.currentCents >= g.targetCents
    if (filter === "risque") {
      const d = daysUntil(g.deadline)
      const pct = g.targetCents > 0 ? g.currentCents / g.targetCents : 1
      return d !== null && d < 30 && pct < 0.8
    }
    return true
  })

  function handleSaved(saved: GoalWithPockets) {
    setGoalList((prev) => {
      const idx = prev.findIndex((g) => g.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
    setModalGoal(null)
    setAddFundsGoal(null)
  }

  function handleDeleted(id: string) {
    setGoalList((prev) => prev.filter((g) => g.id !== id))
    setModalGoal(null)
  }

  return (
    <div className="page-objectifs">
      <div className="page-header">
        <div>
          <h1 className="page-title">Objectifs</h1>
          <div className="page-sub">Où est l&apos;argent, où il doit aller, et si la trajectoire tient</div>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setModalGoal("new")}
        >
          <i className="ti ti-plus" />
          Nouvel objectif
        </button>
      </div>

      <div className="al-chips" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {!loading && goalList.length > 0 && <KpiRow goalList={goalList} />}

      {loadError && <p className="obj-modal-err">{loadError}</p>}

      {loading && <p className="text-secondary">Chargement…</p>}

      {!loading && goalList.length === 0 && (
        <div className="obj-empty">
          <p className="text-secondary obj-empty-msg">
            Aucun objectif d&apos;épargne pour le moment.
          </p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setModalGoal("new")}
          >
            Créer mon premier objectif
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="goals-grid">
          {filtered.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={(goal) => setModalGoal(goal)}
              onAddFunds={(goal) => setAddFundsGoal(goal)}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && goalList.length > 0 && (
        <p className="text-secondary">Aucun objectif dans cette catégorie.</p>
      )}

      {modalGoal !== null && (
        <GoalModal
          goal={modalGoal === "new" ? null : modalGoal}
          accounts={accounts}
          members={members}
          onClose={() => setModalGoal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {addFundsGoal !== null && (
        <AddFundsModal
          goal={addFundsGoal}
          onClose={() => setAddFundsGoal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
