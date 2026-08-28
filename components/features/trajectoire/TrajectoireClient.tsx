"use client"
import { useState, useEffect } from "react"
import { LineChart } from "@/components/charts/LineChart"
import { formatCents } from "@/lib/money"
import type { TrajectoireData, MemberProjection } from "@/app/api/trajectoire/route"

function formatMillions(cents: number): string {
  const euros = cents / 100
  if (Math.abs(euros) >= 1_000_000) {
    return (euros / 1_000_000).toFixed(1) + " M€"
  }
  if (Math.abs(euros) >= 1_000) {
    return (euros / 1_000).toFixed(0) + " k€"
  }
  return euros.toFixed(0) + " €"
}

export function TrajectoireClient() {
  const [data, setData] = useState<TrajectoireData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch("/api/trajectoire")
      .then((r) => r.json())
      .then((json: { data?: TrajectoireData; error?: string }) => {
        if (json.data) {
          setData(json.data)
          setSelectedIds(new Set(json.data.members.map((m) => m.memberId)))
        } else {
          setError(json.error ?? "Erreur inconnue")
        }
      })
      .catch(() => setError("Impossible de charger les projections."))
      .finally(() => setLoading(false))
  }, [])

  const kpi = data?.kpi
  const members = data?.members ?? []
  const selected = members.filter((m) => selectedIds.has(m.memberId))

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Build chart data: union of all years across selected members
  const allYears = Array.from(
    new Set(selected.flatMap((m) => m.yearByYear.map((p) => p.year)))
  ).sort((a, b) => a - b)

  const chartLabels = allYears.map(String)
  const chartSeries = selected.map((m) => {
    const byYear: Record<number, number> = {}
    for (const p of m.yearByYear) byYear[p.year] = p.valueCents
    return {
      label: m.name,
      data: allYears.map((y) => Math.round((byYear[y] ?? 0) / 100)),
      color: m.colorHex,
    }
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Trajectoire retraite</h1>
        <p className="page-sub">Projection du patrimoine à la retraite par membre du foyer.</p>
      </div>

      {error && (
        <div className="card" style={{ color: "var(--danger)" }}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="metrics metrics-3">
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Épargne actuelle</div>
            <div className="metric-ic" style={{ background: "var(--primary-muted)" }}>
              <i className="ti ti-piggy-bank" style={{ color: "var(--primary)" }} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? "—" : kpi ? formatCents(kpi.totalCurrentSavingsCents) : "—"}
          </div>
          <div className="metric-sub neutral">Épargne cumulée du foyer</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Patrimoine projeté</div>
            <div className="metric-ic" style={{ background: "var(--primary-muted)" }}>
              <i className="ti ti-trending-up" style={{ color: "var(--primary)" }} />
            </div>
          </div>
          <div className="metric-value" style={{ color: "var(--primary)" }}>
            {loading ? "—" : kpi ? formatCents(kpi.totalProjectedFVCents) : "—"}
          </div>
          <div className="metric-sub neutral">À la retraite (taux 4%/an)</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Revenu retraite moyen</div>
            <div className="metric-ic" style={{ background: "var(--primary-muted)" }}>
              <i className="ti ti-wallet" style={{ color: "var(--primary)" }} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? "—" : kpi ? formatCents(kpi.avgRetirementIncomeCents) : "—"}
          </div>
          <div className="metric-sub neutral">Par mois (règle des 4%)</div>
        </div>
      </div>

      {/* Member chips */}
      {members.length > 1 && (
        <div className="traj-chips">
          {members.map((m) => (
            <button
              key={m.memberId}
              className={`traj-chip${selectedIds.has(m.memberId) ? " active" : ""}`}
              onClick={() => toggleMember(m.memberId)}
              style={
                selectedIds.has(m.memberId)
                  ? { borderColor: m.colorHex, color: m.colorHex }
                  : undefined
              }
            >
              <span
                className="traj-legend"
                style={{ background: m.colorHex }}
              />
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Line chart */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Projection du patrimoine</div>
          <div className="card-sub">Hypothèse : rendement annuel 4%, règle des 4%</div>
        </div>
        <div className="traj-chart">
          {loading && <p className="text-secondary">Chargement…</p>}
          {!loading && members.length === 0 && (
            <p className="text-secondary">
              Aucun membre avec une date de retraite configurée.
              Renseignez les champs <strong>Année de naissance</strong> et <strong>Retraite prévue</strong> dans Paramètres → Membres.
            </p>
          )}
          {!loading && selected.length > 0 && chartLabels.length > 0 && (
            <LineChart
              labels={chartLabels}
              series={chartSeries}
              yFormatter={(v) => formatMillions(Number(v) * 100)}
            />
          )}
        </div>
      </div>

      {/* Summary table */}
      {!loading && members.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Récapitulatif par membre</div>
          </div>
          <div className="table-scroll">
            <table className="traj-table">
              <thead>
                <tr>
                  <th className="traj-th">Membre</th>
                  <th className="traj-th">Retraite dans</th>
                  <th className="traj-th">Épargne actuelle</th>
                  <th className="traj-th">Patrimoine projeté</th>
                  <th className="traj-th">Revenu mensuel projeté</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: MemberProjection) => (
                  <tr key={m.memberId} className="traj-row">
                    <td className="traj-td">
                      <div className="traj-member-cell">
                        <span className="traj-legend" style={{ background: m.colorHex }} />
                        <span className="fw-600">{m.name}</span>
                      </div>
                    </td>
                    <td className="traj-td">
                      {m.yearsToRetirement} an{m.yearsToRetirement > 1 ? "s" : ""}{" "}
                      <span className="traj-year">({m.retireYear})</span>
                    </td>
                    <td className="traj-td">{formatCents(m.currentSavingsCents)}</td>
                    <td className="traj-td traj-projected">
                      {formatCents(m.projectedFVCents)}
                    </td>
                    <td className="traj-td">{formatCents(m.monthlyRetirementIncomeCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
