"use client"
import { useState, useMemo } from "react"
import Link from "next/link"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { formatCents } from "@/lib/money"
import { percentSpent, budgetTone } from "@/lib/finance/budget"
import { DonutChart } from "@/components/charts/DonutChart"
import { BarChart } from "@/components/charts/BarChart"

export interface DashboardData {
  month: string
  totalIncomeCents: number
  totalExpenseCents: number
  balanceCents: number
  savingsRatePct: number
  byCategory: Array<{
    categoryId: string
    label: string
    icon: string
    colorHex: string
    amountCents: number
  }>
  cashFlow: Array<{
    month: string
    incomeCents: number
    expenseCents: number
  }>
  lastTransactions: Array<{
    id: string
    name: string
    amountCents: number
    date: string
    categoryLabel: string
    categoryIcon: string
    categoryColor: string
    accountName: string
  }>
  budgetSummary: Array<{
    categoryId: string
    label: string
    icon: string
    colorHex: string
    limitCents: number
    spentCents: number
  }>
}

interface Props {
  initialData: DashboardData
}

const MONTHS_FR = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."]

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number)
  return `${MONTHS_FR[mo - 1]} ${y}`
}

function getLast6Months(currentMonth: string): string[] {
  const [yr, mo] = currentMonth.split("-").map(Number)
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    let m = mo - i
    let y = yr
    while (m <= 0) { m += 12; y-- }
    months.push(`${y}-${String(m).padStart(2, "0")}`)
  }
  return months
}

function toneClass(tone: "success" | "warning" | "danger"): "ok" | "warn" | "over" {
  if (tone === "success") return "ok"
  if (tone === "warning") return "warn"
  return "over"
}

export function DashboardClient({ initialData }: Props) {
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(false)
  const { private: isPrivate } = usePrivacy()

  const months = useMemo(() => getLast6Months(initialData.month), [initialData.month])

  async function switchMonth(m: string) {
    if (m === data.month) return
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?month=${m}`)
      const json = await res.json()
      if (!res.ok || !("data" in json)) {
        setLoading(false)
        return
      }
      setData(json.data)
    } finally {
      setLoading(false)
    }
  }

  const donutSlices = data.byCategory.slice(0, 8).map(c => ({
    label: c.label,
    value: c.amountCents / 100,
    color: c.colorHex,
  }))

  const cashFlowLabels = data.cashFlow.map(cf => monthLabel(cf.month))
  const cashFlowSeries = [
    {
      label: "Revenus",
      data: data.cashFlow.map(cf => cf.incomeCents / 100),
      color: "#1D9E75",
    },
    {
      label: "Dépenses",
      data: data.cashFlow.map(cf => cf.expenseCents / 100),
      color: "#D85A30",
    },
  ]

  return (
    <div className="page-dashboard">
      <div className="dash-header">
        <h1>Tableau de bord</h1>
        <Link
          href={`/rapport?month=${data.month}`}
          className="btn-secondary dash-export-btn"
        >
          <i className="ti ti-file-text" />
          Exporter PDF
        </Link>
        <div className="month-chips">
          {months.map(m => (
            <button
              key={m}
              className={`chip${m === data.month ? " active" : ""}`}
              onClick={() => switchMonth(m)}
              disabled={loading}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="loading-bar" />}

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Revenus</div>
          <div className={`kpi-value pos${isPrivate ? " private" : ""}`}>
            {formatCents(data.totalIncomeCents)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Dépenses</div>
          <div className={`kpi-value neg${isPrivate ? " private" : ""}`}>
            {formatCents(data.totalExpenseCents)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Solde</div>
          <div className={`kpi-value${data.balanceCents >= 0 ? " pos" : " neg"}${isPrivate ? " private" : ""}`}>
            {formatCents(data.balanceCents)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Taux d&apos;épargne</div>
          <div className={`kpi-value neutral${isPrivate ? " private" : ""}`}>
            {data.savingsRatePct} %
          </div>
        </div>
      </div>

      {/* Donut + legend */}
      <div className="dash-row">
        <div className="dash-card">
          <div className="dash-card-title">Dépenses par catégorie</div>
          {donutSlices.length > 0
            ? <DonutChart slices={donutSlices} centerLabel={formatCents(data.totalExpenseCents)} />
            : <div className="empty-state">Aucune dépense ce mois</div>
          }
        </div>
        <div className="dash-card">
          <div className="dash-card-title">Répartition</div>
          <div className="cat-legend">
            {data.byCategory.slice(0, 8).map(c => (
              <div key={c.categoryId} className="cat-legend-item">
                <span
                  className="cat-legend-dot"
                  style={{ background: c.colorHex }}
                />
                <span className="cat-legend-label">{c.icon} {c.label}</span>
                <span className={`cat-legend-amt${isPrivate ? " private" : ""}`}>
                  {formatCents(c.amountCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cash flow bar chart */}
      <div className="dash-card">
        <div className="dash-card-title">Flux de trésorerie — 6 derniers mois</div>
        <div className="cashflow-wrap">
          <BarChart labels={cashFlowLabels} series={cashFlowSeries} />
        </div>
      </div>

      {/* Last transactions + budget summary */}
      <div className="dash-row">
        <div className="dash-card">
          <div className="dash-card-title">Dernières transactions</div>
          <div className="last-tx-list">
            {data.lastTransactions.length === 0 && (
              <div className="empty-state">Aucune transaction ce mois</div>
            )}
            {data.lastTransactions.map(tx => (
              <div key={tx.id} className="last-tx-item">
                <div
                  className="last-tx-icon"
                  style={{
                    background: tx.categoryColor + "22",
                    color: tx.categoryColor,
                  }}
                >
                  <i className={`ti ${tx.categoryIcon}`} />
                </div>
                <div className="last-tx-info">
                  <div className="last-tx-name">{tx.name}</div>
                  <div className="last-tx-meta">{tx.categoryLabel} · {tx.accountName}</div>
                </div>
                <div className={`last-tx-amt${tx.amountCents >= 0 ? " pos" : " neg"}${isPrivate ? " private" : ""}`}>
                  {formatCents(tx.amountCents)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-title">Budgets du mois</div>
          <div className="budget-sum-list">
            {data.budgetSummary.length === 0 && (
              <div className="empty-state">Aucun budget ce mois</div>
            )}
            {data.budgetSummary.map(b => {
              const pct = percentSpent(b.spentCents, b.limitCents)
              const tone = budgetTone(b.spentCents, b.limitCents)
              const cls = toneClass(tone)
              return (
                <div key={b.categoryId} className="budget-sum-item">
                  <div className="budget-sum-header">
                    <span className="budget-sum-icon" style={{ color: b.colorHex }}>{b.icon}</span>
                    <span className="budget-sum-label">{b.label}</span>
                    <span className={`budget-sum-amounts${isPrivate ? " private" : ""}`}>
                      {formatCents(b.spentCents)} / {formatCents(b.limitCents)}
                    </span>
                  </div>
                  <div className="budget-sum-bar">
                    <div
                      className={`budget-sum-fill ${cls}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
