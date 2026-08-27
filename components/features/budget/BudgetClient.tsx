"use client"
import { useState } from "react"
import { BudgetCard } from "./BudgetCard"
import { BudgetModal } from "./BudgetModal"
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

export function BudgetClient({ month, budgets: initial, categories }: Props) {
  const [budgetList, setBudgetList] = useState<EnrichedBudget[]>(initial)
  const [editTarget, setEditTarget] = useState<EnrichedBudget | null>(null)
  const { private: priv } = usePrivacy()

  const totalLimit = budgetList.reduce((s, b) => s + b.limitCents, 0)
  const totalSpent = budgetList.reduce((s, b) => s + b.spentCents, 0)
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0

  function handleUpdated(updated: EnrichedBudget) {
    setBudgetList((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    )
    setEditTarget(null)
  }

  return (
    <div className="page-budget">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget · {monthLabel(month)}</h1>
        </div>
      </div>

      <div className="budget-summary card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div className="stat-label">Total budgeté</div>
            <div className={`stat-value ${priv ? "private" : ""}`}>{formatCents(totalLimit)}</div>
          </div>
          <div>
            <div className="stat-label">Total dépensé</div>
            <div className={`stat-value ${priv ? "private" : ""}`}>{formatCents(totalSpent)}</div>
          </div>
          <div>
            <div className="stat-label">Progression globale</div>
            <div className="stat-value">{overallPct} %</div>
          </div>
        </div>
      </div>

      {budgetList.length === 0 ? (
        <p style={{ color: "var(--fg-secondary)" }}>Aucun budget défini pour ce mois.</p>
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

      {editTarget && (
        <BudgetModal
          budget={editTarget}
          month={month}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onSaved={handleUpdated}
        />
      )}
    </div>
  )
}
