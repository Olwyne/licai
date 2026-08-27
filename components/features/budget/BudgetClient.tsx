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

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]

function getMonthOptions(): string[] {
  const now = new Date()
  const options: string[] = []
  for (let i = -2; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    options.push(`${y}-${m}`)
  }
  return options
}

const MONTH_OPTIONS = getMonthOptions()

function monthLabel(month: string): string {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1, 1)
  const label = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function BudgetClient({ month, budgets: initial, categories }: Props) {
  const [budgetList, setBudgetList] = useState<EnrichedBudget[]>(initial)
  const [currentMonth, setCurrentMonth] = useState(month)
  const [loading, setLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<EnrichedBudget | null>(null)
  const { private: priv } = usePrivacy()

  const totalLimit = budgetList.reduce((s, b) => s + b.limitCents, 0)
  const totalSpent = budgetList.reduce((s, b) => s + b.spentCents, 0)
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0

  async function switchMonth(m: string) {
    setCurrentMonth(m)
    setLoading(true)
    const res = await fetch(`/api/budget?month=${m}`)
    const json = await res.json()
    if (json.data) setBudgetList(json.data)
    setLoading(false)
  }

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
          <h1 className="page-title">Budget · {monthLabel(currentMonth)}</h1>
        </div>
      </div>

      <div className="month-chips">
        {MONTH_OPTIONS.map((mo) => (
          <button
            key={mo}
            className={`chip ${mo === currentMonth ? "active" : ""}`}
            onClick={() => switchMonth(mo)}
            disabled={loading}
            type="button"
          >
            {MONTHS_FR[parseInt(mo.split("-")[1]) - 1]}
          </button>
        ))}
      </div>

      <div className="budget-summary card budget-summary-box">
        <div className="budget-summary-stats">
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

      {editTarget && (
        <BudgetModal
          budget={editTarget}
          month={currentMonth}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onSaved={handleUpdated}
        />
      )}
    </div>
  )
}
