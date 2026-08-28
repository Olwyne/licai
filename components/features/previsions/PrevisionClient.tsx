"use client"
import { useState, useEffect } from "react"
import { Chip } from "@/components/ui/Chip"
import { BarChart } from "@/components/charts/BarChart"
import { formatCents } from "@/lib/money"
import type { PrevisionData, MonthForecast } from "@/app/api/previsions/route"

type Horizon = 6 | 12 | 24

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 6, label: "6 mois" },
  { value: 12, label: "12 mois" },
  { value: 24, label: "24 mois" },
]

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleString("fr-FR", {
    month: "long",
    year: "numeric",
  })
}

function shortMonthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleString("fr-FR", {
    month: "short",
    year: "2-digit",
  })
}

export function PrevisionClient() {
  const [horizon, setHorizon] = useState<Horizon>(12)
  const [data, setData] = useState<PrevisionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setError(null)
    fetch(`/api/previsions?horizon=${horizon}`)
      .then((r) => r.json())
      .then((json: { data?: PrevisionData; error?: string }) => {
        if (json.data) setData(json.data)
      })
      .catch(() => {
        setError("Impossible de charger les prévisions.")
      })
      .finally(() => setLoading(false))
  }, [horizon])

  const months = data?.months ?? []
  const kpi = data?.kpi

  // Next 3 months events (flat list)
  const upcomingEvents: Array<{ month: string; name: string; amountCents: number; kind: string }> =
    []
  for (const m of months.slice(0, 3)) {
    for (const e of m.recurringEvents) {
      upcomingEvents.push({ month: m.month, ...e })
    }
  }

  // BarChart data
  const barLabels = months.map((m) => shortMonthLabel(m.month))
  const barSeries = [
    {
      label: "Revenus",
      data: months.map((m) => Math.round(m.incomeCents / 100)),
      color: "var(--primary)",
    },
    {
      label: "Charges",
      data: months.map((m) => Math.round(m.expenseCents / 100)),
      color: "var(--danger)",
    },
  ]

  return (
    <div className="page-previsions">
      <div className="page-header">
        <h1 className="page-title">Prévisions</h1>
        <div className="chips">
          {HORIZONS.map((h) => (
            <Chip
              key={h.value}
              active={horizon === h.value}
              onClick={() => setHorizon(h.value)}
            >
              {h.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-ic">
            <i className="ti ti-trending-up" />
          </div>
          <div className="metric-label">Revenu mensuel moyen</div>
          <div className="metric-value">
            {loading ? "—" : kpi ? formatCents(kpi.avgMonthlyIncomeCents) : "—"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-ic">
            <i className="ti ti-trending-down" />
          </div>
          <div className="metric-label">Charges mensuelles</div>
          <div className="metric-value">
            {loading ? "—" : kpi ? formatCents(kpi.avgMonthlyExpenseCents) : "—"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-ic">
            <i className="ti ti-scale" />
          </div>
          <div className="metric-label">Solde projeté ({horizon} mois)</div>
          <div
            className="metric-value"
            style={
              kpi
                ? {
                    color:
                      kpi.projectedAnnualBalanceCents >= 0
                        ? "var(--primary)"
                        : "var(--danger)",
                  }
                : undefined
            }
          >
            {loading ? "—" : kpi ? formatCents(kpi.projectedAnnualBalanceCents) : "—"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-ic">
            <i className="ti ti-repeat" />
          </div>
          <div className="metric-label">Récurrents / mois</div>
          <div className="metric-value">
            {loading ? "—" : kpi ? formatCents(kpi.totalRecurringMonthlyCents) : "—"}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid-7-5">
        {/* Bar chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Trésorerie prévisionnelle</div>
          </div>
          <div className="prevision-chart">
            {!loading && months.length > 0 && (
              <BarChart labels={barLabels} series={barSeries} />
            )}
            {loading && <p className="text-secondary">Chargement…</p>}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Événements à anticiper</div>
          </div>
          <div className="stat-list">
            {loading && <p className="text-secondary">Chargement…</p>}
            {!loading && upcomingEvents.length === 0 && (
              <p className="text-secondary">Aucun événement récurrent.</p>
            )}
            {upcomingEvents.map((e, i) => (
              <div className="stat-row" key={i}>
                <div className="stat-row-left">
                  <span className="stat-row-label">{e.name}</span>
                  <span className="stat-row-sub">{monthLabel(e.month)}</span>
                </div>
                <div
                  className="stat-row-value"
                  style={{
                    color: e.amountCents >= 0 ? "var(--primary)" : "var(--danger)",
                  }}
                >
                  {formatCents(e.amountCents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly detail table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Détail mois par mois</div>
        </div>
        <div className="table-scroll">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Revenus</th>
                <th>Charges</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="text-secondary">
                    Chargement…
                  </td>
                </tr>
              )}
              {months.map((m: MonthForecast) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{formatCents(m.incomeCents)}</td>
                  <td>{formatCents(m.expenseCents)}</td>
                  <td
                    className="fw-600"
                    style={{
                      color:
                        m.balanceCents >= 0 ? "var(--primary)" : "var(--danger)",
                    }}
                  >
                    {formatCents(m.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
