"use client"
import { useState, useEffect, useCallback } from "react"
import { Chip } from "@/components/ui/Chip"
import { formatCents } from "@/lib/money"
import type { Goal } from "@/db/schema"

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

// ─── GoalModal ───────────────────────────────────────────────────────────────

interface GoalModalProps {
  goal: Goal | null
  onClose: () => void
  onSaved: (g: Goal) => void
  onDeleted: (id: string) => void
}

function GoalModal({ goal, onClose, onSaved, onDeleted }: GoalModalProps) {
  const isEdit = goal !== null
  const [name, setName] = useState(goal?.name ?? "")
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯")
  const [targetEuros, setTargetEuros] = useState(
    goal ? (goal.targetCents / 100).toFixed(2) : ""
  )
  const [deadline, setDeadline] = useState(goal?.deadline ?? "")
  const [kind, setKind] = useState<"court" | "long">(
    (goal?.kind as "court" | "long") ?? "court"
  )
  const [colorHex, setColorHex] = useState(goal?.colorHex ?? "#1D9E75")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(targetEuros.replace(",", "."))
    if (!name.trim() || isNaN(parsed) || parsed <= 0) {
      setError("Nom et montant cible sont requis.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        emoji,
        targetCents: Math.round(parsed * 100),
        deadline: deadline || null,
        kind,
        colorHex,
      }
      const res = await fetch(isEdit ? `/api/goals/${goal.id}` : "/api/goals", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      const json = (await res.json()) as { data: Goal }
      onSaved(json.data)
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!goal) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" })
      if (res.ok) onDeleted(goal.id)
      else setError("Erreur lors de la suppression.")
    } catch {
      setError("Erreur réseau.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? "Modifier l'objectif" : "Nouvel objectif"}
          </h2>
          <button className="modal-close" onClick={onClose} type="button">
            <i className="ti ti-x" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="goal-name">Nom</label>
            <input
              id="goal-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Voyage au Japon"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="goal-emoji">Emoji</label>
            <input
              id="goal-emoji"
              className="form-input"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="goal-target">Montant cible (€)</label>
            <input
              id="goal-target"
              className="form-input"
              type="number"
              min="1"
              step="0.01"
              value={targetEuros}
              onChange={(e) => setTargetEuros(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="goal-deadline">Échéance (optionnel)</label>
            <input
              id="goal-deadline"
              className="form-input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Terme</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["court", "long"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip ${kind === k ? "active" : ""}`}
                  onClick={() => setKind(k)}
                >
                  {k === "court" ? "Court terme" : "Long terme"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Couleur</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorHex(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: c,
                    border: colorHex === c ? "3px solid var(--fg)" : "3px solid transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

          <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {isEdit && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            )}
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── AddFundsModal ────────────────────────────────────────────────────────────

interface AddFundsModalProps {
  goal: Goal
  onClose: () => void
  onSaved: (g: Goal) => void
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
      const json = (await res.json()) as { data: Goal }
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
          {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal
  onEdit: (g: Goal) => void
  onAddFunds: (g: Goal) => void
}

function GoalCard({ goal, onEdit, onAddFunds }: GoalCardProps) {
  const pct = goal.targetCents > 0
    ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100))
    : 0

  return (
    <div className="goal-card" onClick={() => onEdit(goal)} style={{ cursor: "pointer" }}>
      <div className="goal-top">
        <div
          className="goal-emoji"
          style={{ background: goal.colorHex + "22" }}
        >
          {goal.emoji}
        </div>
        <div>
          <div className="goal-name">{goal.name}</div>
          <div className="goal-deadline">{deadlineLabel(goal.deadline)}</div>
        </div>
      </div>

      <div className="goal-amounts">
        <span className="goal-current">{formatCents(goal.currentCents)}</span>
        <span className="goal-target">/ {formatCents(goal.targetCents)}</span>
      </div>

      <div className="goal-bar">
        <div
          style={{
            width: `${pct}%`,
            background: goal.colorHex,
          }}
        />
      </div>

      <div className="goal-foot">
        <span className="goal-pct"><b>{pct} %</b> atteint</span>
        <button
          className="goal-add"
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddFunds(goal) }}
        >
          <i className="ti ti-plus" style={{ fontSize: 13 }} />
          Ajouter
        </button>
      </div>
    </div>
  )
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function KpiRow({ goalList }: { goalList: Goal[] }) {
  const totalTarget = goalList.reduce((s, g) => s + g.targetCents, 0)
  const totalCurrent = goalList.reduce((s, g) => s + g.currentCents, 0)
  const reached = goalList.filter((g) => g.currentCents >= g.targetCents).length

  const deadlines = goalList
    .filter((g) => g.deadline && g.currentCents < g.targetCents)
    .map((g) => g.deadline as string)
    .sort()

  const nextDeadline = deadlines.length > 0
    ? new Date(deadlines[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "—"

  return (
    <div className="kpi-row" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
      <div className="kpi-card">
        <div className="kpi-label">Total visé</div>
        <div className="kpi-value">{formatCents(totalTarget)}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Épargne accumulée</div>
        <div className="kpi-value">{formatCents(totalCurrent)}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Objectifs atteints</div>
        <div className="kpi-value">{reached} / {goalList.length}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Prochaine échéance</div>
        <div className="kpi-value">{nextDeadline}</div>
      </div>
    </div>
  )
}

// ─── Main client component ───────────────────────────────────────────────────

export default function ObjectifsClient() {
  const [goalList, setGoalList] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterMode>("tous")
  const [modalGoal, setModalGoal] = useState<Goal | null | "new">(null)
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/goals")
      if (res.ok) {
        const json = (await res.json()) as { data: Goal[] }
        setGoalList(json.data)
      }
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

  function handleSaved(saved: Goal) {
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
        <h1 className="page-title">Objectifs d&apos;épargne</h1>
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

      {loading && <p className="text-secondary">Chargement…</p>}

      {!loading && goalList.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p className="text-secondary" style={{ marginBottom: 16 }}>
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
