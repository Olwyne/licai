"use client"
import { useState } from "react"
import { BudgetCard } from "./BudgetCard"
import { CategoryModal } from "./CategoryModal"
import { formatCents } from "@/lib/money"
import { usePrivacy } from "@/contexts/PrivacyContext"
import type { Category } from "@/db/schema"
import type { EnrichedBudget } from "@/app/(app)/budget/page"

interface Props {
  month: string
  budgets: EnrichedBudget[]
  categories: Category[]
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1, 1)
  const label = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function offsetMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function BudgetClient({ month, budgets: initial, categories }: Props) {
  const [budgetList, setBudgetList] = useState<EnrichedBudget[]>(initial)
  const [currentMonth, setCurrentMonth] = useState(month)
  const [loading, setLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<EnrichedBudget | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [catList, setCatList] = useState<Category[]>(categories)
  const { private: priv } = usePrivacy()

  const totalLimit = budgetList.reduce((s, b) => s + b.limitCents, 0)
  const totalSpent = budgetList.reduce((s, b) => s + b.spentCents, 0)
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0

  async function switchMonth(m: string) {
    setCurrentMonth(m)
    setLoading(true)
    const res = await fetch(`/api/budget?month=${m}`)
    const json = await res.json()
    if (json.data) {
      const enriched = (json.data as EnrichedBudget[]).map((b) => ({
        ...b,
        spentCents: b.spentCents ?? 0,
        category: b.category ?? catList.find((c) => c.id === b.categoryId) ?? null,
      }))
      setBudgetList(enriched)
    }
    setLoading(false)
  }

  function handleUpdated(updated: EnrichedBudget) {
    setBudgetList((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    )
    setEditTarget(null)
  }

  function handleAdded(cat: Category, budget: EnrichedBudget) {
    setCatList((prev) => prev.some((c) => c.id === cat.id) ? prev : [...prev, cat])
    setBudgetList((prev) => [...prev, budget])
    setShowAdd(false)
  }

  return (
    <div className="page-budget">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget</h1>
          <div className="page-sub">Plafonds mensuels par catégorie</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => switchMonth(offsetMonth(currentMonth, -1))}
              disabled={loading}
              title="Mois précédent"
            >
              <i className="ti ti-chevron-left" />
            </button>
            <button className="budget-month-select" type="button" disabled>
              <i className="ti ti-calendar" />
              {monthLabel(currentMonth)}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => switchMonth(offsetMonth(currentMonth, 1))}
              disabled={loading}
              title="Mois suivant"
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowAdd(true)}>
            <i className="ti ti-plus" /> Ajouter une catégorie
          </button>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Budget total</span>
            <span className="metric-ic" style={{ background: "#1D9E7520" }}><i className="ti ti-wallet" style={{ color: "#1D9E75" }} /></span>
          </div>
          <div className={`metric-value${priv ? " private" : ""}`}>{formatCents(totalLimit)}</div>
          <div className="metric-sub neutral">{budgetList.length} catégorie{budgetList.length !== 1 ? "s" : ""} active{budgetList.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Dépensé</span>
            <span className="metric-ic" style={{ background: "#D85A3020" }}><i className="ti ti-receipt" style={{ color: "#D85A30" }} /></span>
          </div>
          <div className={`metric-value${priv ? " private" : ""}`}>{formatCents(totalSpent)}</div>
          <div className="metric-sub neutral">{overallPct} % du budget</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Restant</span>
            <span className="metric-ic" style={{ background: "#EF9F2720" }}><i className="ti ti-coin-euro" style={{ color: "#EF9F27" }} /></span>
          </div>
          <div className={`metric-value${priv ? " private" : ""}`} style={{ color: totalLimit - totalSpent >= 0 ? "var(--primary)" : "var(--danger)" }}>
            {formatCents(Math.abs(totalLimit - totalSpent))}
          </div>
          <div className={`metric-sub ${totalLimit - totalSpent >= 0 ? "up" : "down"}`}>
            {totalLimit - totalSpent >= 0 ? "✓ Sur la bonne voie" : "⚠ Budget dépassé"}
          </div>
        </div>
      </div>

      {budgetList.length === 0 ? (
        <p className="text-secondary">Aucun budget défini pour ce mois.</p>
      ) : (
        <div className="budget-grid">
          {budgetList.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              onEdit={() => setEditTarget(b)}
            />
          ))}
        </div>
      )}

      {(editTarget || showAdd) && (
        <CategoryModal
          month={currentMonth}
          categories={catList}
          budget={editTarget}
          onClose={() => { setEditTarget(null); setShowAdd(false) }}
          onSaved={(cat, b) => { editTarget ? handleUpdated(b) : handleAdded(cat, b); setCatList((prev) => prev.map((c) => (c.id === cat.id ? cat : c))); setEditTarget(null); setShowAdd(false) }}
          onRemoved={(id) => { setBudgetList((prev) => prev.filter((b) => b.id !== id)); setEditTarget(null); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
