"use client"
import { formatCents } from "@/lib/money"
import { percentSpent, budgetTone } from "@/lib/finance/budget"
import { usePrivacy } from "@/contexts/PrivacyContext"
import type { EnrichedBudget } from "@/app/(app)/budget/page"

interface Props {
  budget: EnrichedBudget
  onEdit: () => void
}

function toneToBarClass(tone: "success" | "warning" | "danger"): string {
  if (tone === "danger") return "over"
  if (tone === "warning") return "warn"
  return "ok"
}

export function BudgetCard({ budget, onEdit }: Props) {
  const { private: priv } = usePrivacy()
  const { spentCents, limitCents, category } = budget
  const pct = percentSpent(spentCents, limitCents)
  const tone = budgetTone(spentCents, limitCents)
  const barClass = toneToBarClass(tone)
  const remainCents = limitCents - spentCents
  const displayPct = Math.min(pct, 100)

  return (
    <div className="budget-card">
      <div className="budget-card-head">
        <div className="budget-name">
          {category && (
            <i aria-hidden="true" className={`ti ${category.icon}`} style={{ color: category.colorHex }} />
          )}
          <span>{category?.label ?? "Catégorie"}</span>
        </div>
        <button
          className="budget-edit-btn"
          onClick={onEdit}
          type="button"
          title="Modifier le budget"
        >
          <i aria-hidden="true" className="ti ti-pencil" />
        </button>
      </div>

      <div className="budget-amounts">
        <span className={`budget-spent ${priv ? "private" : ""}`}>
          {formatCents(spentCents)}
        </span>
        <span className={`budget-limit ${priv ? "private" : ""}`}>
          sur {formatCents(limitCents)}
        </span>
      </div>

      <div className="bar-bg">
        <div
          className={`bar-fill ${barClass}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      <div className="budget-foot">
        <span>{Math.round(pct)} %</span>
        <span className={`budget-remain ${remainCents < 0 ? "over" : ""} ${priv ? "private" : ""}`}>
          {remainCents >= 0
            ? `${formatCents(remainCents)} restants`
            : `${formatCents(Math.abs(remainCents))} dépassés`}
        </span>
      </div>
    </div>
  )
}
