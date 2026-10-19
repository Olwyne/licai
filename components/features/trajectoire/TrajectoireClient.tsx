"use client"
import { useState, useEffect, useMemo } from "react"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Legend, Filler,
} from "chart.js"
import Link from "next/link"
import { formatCents } from "@/lib/money"
import type { TrajectoireData, GoalProjection } from "@/app/api/trajectoire/route"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  const euros = Math.abs(cents) / 100
  if (euros >= 1_000_000) return (euros / 1_000_000).toFixed(1) + " M€"
  if (euros >= 1_000) return Math.round(euros / 1000) + " k€"
  return Math.round(euros).toLocaleString("fr-FR") + " €"
}

function fmtDelta(cents: number): string {
  const sign = cents >= 0 ? "+" : "−"
  return `${sign} ${fmt(Math.abs(cents))}`
}

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
}

function computeIFMonths(
  capitalCents: number,
  monthlyCents: number,
  capitalCibleCents: number,
  rNominal: number,
  inflation: number,
  extraMonthlyCents: number
): number {
  if (capitalCents >= capitalCibleCents) return 0
  const rReal = (1 + rNominal) / (1 + inflation) - 1
  const r_mo = Math.pow(1 + rReal, 1 / 12) - 1
  const total = monthlyCents + extraMonthlyCents
  let cap = capitalCents
  for (let m = 1; m <= 600; m++) {
    cap = cap * (1 + r_mo) + total
    if (cap >= capitalCibleCents) return m
  }
  return 600
}

function monthsToLabel(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
}

function yearsMonthsDiff(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  return m > 0 ? `${y} ans ${m} mois` : `${y} ans`
}

function probabilityLabel(pct: number): string {
  if (pct === 100) return "atteint"
  return `${pct} %`
}

function probabilityColor(pct: number): string {
  if (pct === 100) return "var(--primary)"
  if (pct >= 80) return "var(--primary)"
  if (pct >= 40) return "#EF9F27"
  return "var(--fg-muted)"
}

function deadlineFmt(deadline: string | null): string {
  if (!deadline) return "—"
  const d = new Date(deadline)
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
}

// ─── Simulator chart ─────────────────────────────────────────────────────────

function SimChart({
  capitalFinancierCents,
  monthlySavingsCents,
  capitalCibleCents,
  rNominal,
  inflation,
  extraMonthlyCents,
  ifMonths,
}: {
  capitalFinancierCents: number
  monthlySavingsCents: number
  capitalCibleCents: number
  rNominal: number
  inflation: number
  extraMonthlyCents: number
  ifMonths: number
}) {
  const horizonMonths = Math.min(ifMonths + 36, 600)
  const rReal = (1 + rNominal) / (1 + inflation) - 1
  const r_mo = Math.pow(1 + rReal, 1 / 12) - 1
  const total = monthlySavingsCents + extraMonthlyCents

  const labels: string[] = []
  const projected: number[] = []
  const cible: number[] = []
  const nowYear = new Date().getFullYear()

  let cap = capitalFinancierCents
  const step = Math.max(1, Math.floor(horizonMonths / 60))

  for (let m = 0; m <= horizonMonths; m += step) {
    const yr = nowYear + Math.floor(m / 12)
    labels.push(String(yr))
    projected.push(Math.round(cap / 100))
    cible.push(Math.round(capitalCibleCents / 100))
    for (let s = 0; s < step && m + s < horizonMonths; s++) {
      cap = cap * (1 + r_mo) + total
    }
  }

  const data = {
    labels,
    datasets: [
      {
        label: "Capital projeté",
        data: projected,
        borderColor: "#1D9E75",
        backgroundColor: "#1D9E7522",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
      {
        label: "Capital cible",
        data: cible,
        borderColor: "#EF9F27",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" as const, align: "end" as const, labels: { boxWidth: 12, font: { size: 12 } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: "rgba(128,128,128,0.1)" },
        ticks: {
          font: { size: 11 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => {
            const n = Number(v)
            if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
            if (n >= 1000) return Math.round(n / 1000) + "k"
            return n
          },
        },
      },
    },
  }

  return <Line data={data} options={options} />
}

// ─── Patrimoine chart ─────────────────────────────────────────────────────────

function PatriChart({
  chartPoints,
  mode,
}: {
  chartPoints: TrajectoireData["chartPoints"]
  mode: "12m" | "24m+"
}) {
  const points = mode === "12m"
    ? chartPoints.filter(p => !p.isProjection).slice(-13)
    : chartPoints

  const labels = points.map(p => {
    const [y, m] = p.date.split("-").map(Number)
    return new Date(y, m - 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
  })

  const historicalData = points.map(p => p.isProjection ? null : Math.round(p.patrimoineNetCents / 100))
  const projectionData = points.map((p, i) => {
    if (!p.isProjection && i < points.length - 1 && !points[i + 1]?.isProjection) return null
    return Math.round(p.patrimoineNetCents / 100)
  })

  const data = {
    labels,
    datasets: [
      {
        label: "Constaté",
        data: historicalData,
        borderColor: "#1D9E75",
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        spanGaps: false,
      },
      ...(mode === "24m+" ? [{
        label: "Projection",
        data: projectionData,
        borderColor: "#378ADD",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        spanGaps: false,
      }] : []),
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: mode === "24m+", position: "top" as const, align: "end" as const, labels: { boxWidth: 12, font: { size: 12 } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
      y: {
        grid: { color: "rgba(128,128,128,0.1)" },
        ticks: {
          font: { size: 11 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => {
            const n = Number(v)
            if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
            if (n >= 1000) return Math.round(n / 1000) + "k"
            return n
          },
        },
      },
    },
  }

  return <Line data={data} options={options} />
}

// ─── Goals table ─────────────────────────────────────────────────────────────

function GoalsTable({ goals }: { goals: GoalProjection[] }) {
  return (
    <div className="table-scroll">
      <table className="traj-table">
        <thead>
          <tr>
            <th className="traj-th">Objectif</th>
            <th className="traj-th">Échéance</th>
            <th className="traj-th">Constitué</th>
            <th className="traj-th">Cible</th>
            <th className="traj-th">Effort</th>
            <th className="traj-th">Projeté</th>
            <th className="traj-th">Probabilité</th>
          </tr>
        </thead>
        <tbody>
          {goals.map(g => {
            const pct = g.targetCents > 0
              ? Math.min(100, Math.round(g.currentCents / g.targetCents * 100))
              : 100
            return (
              <tr key={g.id} className="traj-row">
                <td className="traj-td">
                  <div style={{ fontWeight: 600 }}>{g.emoji} {g.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                    {g.pocketCount > 0 ? `${g.pocketCount} poche${g.pocketCount > 1 ? "s" : ""} adossée${g.pocketCount > 1 ? "s" : ""}` : "compartiment suivi à la main"}
                  </div>
                </td>
                <td className="traj-td traj-year">{deadlineFmt(g.deadline)}</td>
                <td className="traj-td">{formatCents(g.currentCents)}</td>
                <td className="traj-td">{formatCents(g.targetCents)}</td>
                <td className="traj-td">{g.monthlyEffortCents > 0 ? formatCents(g.monthlyEffortCents) : "—"}</td>
                <td className="traj-td traj-projected">{formatCents(g.projectedCents)}</td>
                <td className="traj-td">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 40, height: 4, borderRadius: 2,
                      background: "var(--border)", overflow: "hidden",
                    }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: probabilityColor(g.probabilityPct) }} />
                    </div>
                    <span style={{ color: probabilityColor(g.probabilityPct), fontWeight: 600, fontSize: 12 }}>
                      {probabilityLabel(g.probabilityPct)}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TrajectoireClient() {
  const [data, setData] = useState<TrajectoireData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<"12m" | "24m+">("24m+")

  // IF simulator state
  const [annualExpenses, setAnnualExpenses] = useState(0)
  const [withdrawalRate, setWithdrawalRate] = useState(4)
  const [rNominal, setRNominal] = useState(5)
  const [inflation, setInflation] = useState(2)
  const [extraMonthly, setExtraMonthly] = useState(0)

  useEffect(() => {
    fetch("/api/trajectoire")
      .then(r => r.json())
      .then((json: { data?: TrajectoireData; error?: string }) => {
        if (json.data) {
          setData(json.data)
          setAnnualExpenses(Math.round(json.data.annualExpensesCents / 100))
        } else {
          setError(json.error ?? "Erreur inconnue")
        }
      })
      .catch(() => setError("Impossible de charger les données."))
      .finally(() => setLoading(false))
  }, [])

  const sim = useMemo(() => {
    if (!data) return null
    const capitalCibleCents = Math.round(annualExpenses * 100 / (withdrawalRate / 100))
    const rN = rNominal / 100
    const inf = inflation / 100
    const extraCents = extraMonthly * 100
    const ifMonths = computeIFMonths(
      data.capitalFinancierCents, data.epargneMenusuelleCents,
      capitalCibleCents, rN, inf, extraCents
    )
    const coveragePct = capitalCibleCents > 0
      ? Math.round(data.capitalFinancierCents / capitalCibleCents * 100)
      : 0
    const renteCents = Math.round(capitalCibleCents * (withdrawalRate / 100) / 12)
    const realReturn = Math.round(((1 + rN) / (1 + inf) - 1) * 100 * 10) / 10

    // Scenarios
    const baseMonths = ifMonths
    const s200 = computeIFMonths(data.capitalFinancierCents, data.epargneMenusuelleCents, capitalCibleCents, rN, inf, extraCents + 20000)
    const s35 = computeIFMonths(data.capitalFinancierCents, data.epargneMenusuelleCents, Math.round(annualExpenses * 100 / 0.035), rN, inf, extraCents)
    const sR3 = computeIFMonths(data.capitalFinancierCents, data.epargneMenusuelleCents, capitalCibleCents, 0.03, inf, extraCents)
    const sDep = computeIFMonths(data.capitalFinancierCents, data.epargneMenusuelleCents, Math.round(annualExpenses * 100 * 0.9 / (withdrawalRate / 100)), rN, inf, extraCents)

    return {
      capitalCibleCents,
      ifMonths,
      coveragePct,
      renteCents,
      realReturn,
      scenarios: [
        { label: "Épargne +200 €/mois", months: s200, delta: baseMonths - s200 },
        { label: `Retrait à 3,5 %`, months: s35, delta: baseMonths - s35 },
        { label: "Rendement 3 %", months: sR3, delta: baseMonths - sR3 },
        { label: "Dépenses −10 %", months: sDep, delta: baseMonths - sDep },
      ],
    }
  }, [data, annualExpenses, withdrawalRate, rNominal, inflation, extraMonthly])

  const delta12NetCents = useMemo(() => {
    if (!data) return 0
    return Math.round(
      (data.delta24LiquiditesCents + data.delta24PlacementsCents +
        data.delta24ImmobilierCents + data.delta24DettesCents) / 2
    )
  }, [data])

  const savingsRatePct = data && data.totalMonthlyIncomeCents > 0
    ? Math.round(data.epargneMenusuelleCents / data.totalMonthlyIncomeCents * 100 * 10) / 10
    : 0

  const ifDate = sim ? monthsToLabel(sim.ifMonths) : "—"
  const ifYearsMonths = sim ? yearsMonthsDiff(sim.ifMonths) : "—"

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Trajectoire</h1>
        <p className="page-sub">Patrimoine net, indépendance financière et projection</p>
      </div>

      {error && (
        <div className="card" style={{ color: "var(--danger)" }}>
          <i aria-hidden="true" className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Patrimoine net</div>
            <div className="metric-ic" style={{ background: "var(--primary-muted)" }}>
              <i aria-hidden="true" className="ti ti-database" style={{ color: "var(--primary)" }} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? "—" : data ? fmt(data.patrimoineNetCents) : "—"}
          </div>
          <div className={`metric-sub ${delta12NetCents >= 0 ? "up" : "down"}`}>
            <i aria-hidden="true" className={`ti ti-trending-${delta12NetCents >= 0 ? "up" : "down"}`} />
            {loading ? "—" : fmtDelta(delta12NetCents)} sur 12 mois
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Épargne mensuelle</div>
            <div className="metric-ic" style={{ background: "var(--primary-muted)" }}>
              <i aria-hidden="true" className="ti ti-refresh" style={{ color: "var(--primary)" }} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? "—" : data ? fmt(data.epargneMenusuelleCents) : "—"}
          </div>
          <div className="metric-sub neutral">
            {loading ? "—" : `${savingsRatePct} % des revenus du foyer`}
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Capital cible</div>
            <div className="metric-ic" style={{ background: "#7C6BD622" }}>
              <i aria-hidden="true" className="ti ti-target" style={{ color: "#7C6BD6" }} />
            </div>
          </div>
          <div className="metric-value">
            {loading ? "—" : sim ? fmt(sim.capitalCibleCents) : "—"}
          </div>
          <div className="metric-sub neutral">
            {loading ? "—" : sim ? `${withdrawalRate} % de retrait sur ${Math.round(annualExpenses).toLocaleString("fr-FR")} €/an` : "—"}
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <div className="metric-label">Indépendance financière</div>
            <div className="metric-ic" style={{ background: "#EF9F2722" }}>
              <i aria-hidden="true" className="ti ti-flag" style={{ color: "#EF9F27" }} />
            </div>
          </div>
          <div className="metric-value" style={{ fontSize: 22 }}>
            {loading ? "—" : ifDate}
          </div>
          <div className="metric-sub neutral">
            {loading ? "—" : `dans ${ifYearsMonths}`}
          </div>
        </div>
      </div>

      {/* Chart + Composition */}
      {!loading && data && (
        <div className="traj-split" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, alignItems: "start" }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Patrimoine net dans le temps</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setChartMode("12m")}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: chartMode === "12m" ? "var(--primary)" : "transparent",
                    color: chartMode === "12m" ? "#fff" : "var(--fg-secondary)",
                    cursor: "pointer",
                  }}
                >12 mois</button>
                <button
                  onClick={() => setChartMode("24m+")}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: chartMode === "24m+" ? "var(--primary)" : "transparent",
                    color: chartMode === "24m+" ? "#fff" : "var(--fg-secondary)",
                    cursor: "pointer",
                  }}
                >24 mois + projection</button>
              </div>
            </div>
            <div className="traj-chart">
              <PatriChart chartPoints={data.chartPoints} mode={chartMode} />
            </div>
          </div>

          {/* Composition */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Composition</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                {
                  label: "Liquidités & épargne",
                  value: data.liquiditesCents,
                  delta: data.delta24LiquiditesCents,
                  icon: "ti-wallet",
                  color: "#378ADD",
                  sign: 1,
                },
                {
                  label: "Placements financiers",
                  value: data.placementsCents,
                  delta: data.delta24PlacementsCents,
                  icon: "ti-chart-line",
                  color: "#7C6BD6",
                  sign: 1,
                },
                {
                  label: "Immobilier estimé",
                  value: data.immobilierCents,
                  delta: data.delta24ImmobilierCents,
                  icon: "ti-home",
                  color: "#EF9F27",
                  sign: 1,
                },
                {
                  label: "Dettes",
                  value: -data.dettesCents,
                  delta: data.delta24DettesCents,
                  deltaLabel: "remboursés",
                  icon: "ti-credit-card",
                  color: "var(--danger)",
                  sign: -1,
                },
              ].map(item => (
                <div key={item.label} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i aria-hidden="true" className={`ti ${item.icon}`} style={{ color: item.color, fontSize: 14 }} />
                      <span style={{ fontSize: 13, color: "var(--fg-secondary)" }}>{item.label}</span>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: item.sign < 0 ? "var(--danger)" : "var(--fg)" }}>
                      {item.sign < 0 && item.value !== 0 ? "− " : ""}{fmt(Math.abs(item.value))}
                    </span>
                  </div>
                  {item.delta > 0 && (
                    <div style={{ fontSize: 11, color: item.sign > 0 ? "var(--primary)" : "var(--fg-muted)", marginTop: 2, paddingLeft: 22 }}>
                      + {fmt(item.delta)} {item.deltaLabel ?? "sur 24 mois"}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Patrimoine net</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--primary)" }}>
                  {fmt(data.patrimoineNetCents)}
                </span>
              </div>
              {data.dettesCents > 0 && (
                <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Taux d'endettement patrimonial{" "}
                  {Math.round(data.dettesCents / (data.liquiditesCents + data.placementsCents + data.immobilierCents) * 100 * 10) / 10} %
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IF Simulator */}
      {!loading && data && sim && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Simulateur d'indépendance financière</div>
            <div className="card-sub">Règle des {withdrawalRate} % · rendement réel {sim.realReturn} %</div>
          </div>

          {/* Inputs */}
          <div className="traj-5" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              {
                label: "Dépenses annuelles visées",
                value: annualExpenses,
                onChange: (v: number) => setAnnualExpenses(v),
                suffix: "€",
                hint: `Aujourd'hui ${Math.round((data.totalMonthlyIncomeCents - data.epargneMenusuelleCents) / 100).toLocaleString("fr-FR")} € / mois`,
              },
              {
                label: "Taux de retrait",
                value: withdrawalRate,
                onChange: (v: number) => setWithdrawalRate(v),
                suffix: "%",
                hint: "4 % = règle de Trinity",
                step: 0.5,
              },
              {
                label: "Rendement annuel espéré",
                value: rNominal,
                onChange: (v: number) => setRNominal(v),
                suffix: "%",
                hint: "Avant inflation",
                step: 0.5,
              },
              {
                label: "Inflation retenue",
                value: inflation,
                onChange: (v: number) => setInflation(v),
                suffix: "%",
                hint: "",
                step: 0.5,
              },
              {
                label: "Effort mensuel additionnel",
                value: extraMonthly,
                onChange: (v: number) => setExtraMonthly(v),
                suffix: "€",
                hint: `Épargne actuelle ${fmt(data.epargneMenusuelleCents)}`,
              },
            ].map(inp => (
              <div key={inp.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{inp.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                  <input
                    type="number"
                    value={inp.value}
                    step={inp.step ?? 1}
                    onChange={e => inp.onChange(parseFloat(e.target.value) || 0)}
                    style={{ flex: 1, border: "none", background: "transparent", color: "var(--fg)", fontSize: 15, fontWeight: 600, outline: "none", width: 0 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{inp.suffix}</span>
                </div>
                {inp.hint && <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{inp.hint}</div>}
              </div>
            ))}
          </div>

          {/* Output KPIs */}
          <div className="traj-5" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16, padding: "12px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
            {[
              { label: "Capital nécessaire", value: fmt(sim.capitalCibleCents) },
              { label: "Capital financier actuel", value: fmt(data.capitalFinancierCents) },
              { label: "Couverture des dépenses", value: `${sim.coveragePct} %` },
              { label: "Date estimée", value: ifDate },
              { label: "Rente mensuelle à terme", value: fmt(sim.renteCents) },
            ].map(kpi => (
              <div key={kpi.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{kpi.label}</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Simulator chart */}
          <div style={{ height: 220, marginBottom: 16 }}>
            <SimChart
              capitalFinancierCents={data.capitalFinancierCents}
              monthlySavingsCents={data.epargneMenusuelleCents}
              capitalCibleCents={sim.capitalCibleCents}
              rNominal={rNominal / 100}
              inflation={inflation / 100}
              extraMonthlyCents={extraMonthly * 100}
              ifMonths={sim.ifMonths}
            />
          </div>

          {/* Scenarios */}
          <div className="traj-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {sim.scenarios.map(sc => (
              <div key={sc.label} style={{
                padding: "10px 12px", borderRadius: 8,
                background: "var(--card-hover)", border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 4 }}>{sc.label}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{monthsToLabel(sc.months)}</div>
                <div style={{ fontSize: 12, color: sc.delta > 0 ? "var(--primary)" : "var(--danger)", marginTop: 2 }}>
                  {sc.delta > 0 ? "−" : "+"} {Math.abs(Math.round(sc.delta / 12 * 10) / 10).toFixed(1)} ans
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 14, lineHeight: 1.5 }}>
            <i aria-hidden="true" className="ti ti-info-circle" /> Projection déterministe à rendement constant : la réalité est volatile et la séquence des rendements compte autant que leur moyenne. Aucune garantie de résultat.
          </p>
        </div>
      )}

      {/* Objectifs fléchés */}
      {!loading && data && data.goals.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Objectifs fléchés</div>
            <div className="card-sub">
              {fmt(data.totalMonthlyGoalEffortCents)} / mois fléchés ·{" "}
              {fmt(data.epargneMenusuelleCents)} d'épargne dégagée
            </div>
            <Link className="card-link" href="/objectifs">Gérer</Link>
          </div>
          <GoalsTable goals={data.goals} />
        </div>
      )}

      {/* Projection table */}
      {!loading && data && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Projection du patrimoine</div>
            <div className="card-sub">À effort d'épargne constant</div>
          </div>
          <div className="table-scroll">
            <table className="traj-table">
              <thead>
                <tr>
                  <th className="traj-th">Horizon</th>
                  <th className="traj-th">Financier</th>
                  <th className="traj-th">Immobilier</th>
                  <th className="traj-th">Dettes</th>
                  <th className="traj-th">Patrimoine net</th>
                  <th className="traj-th">Variation</th>
                </tr>
              </thead>
              <tbody>
                {data.projections.map(row => {
                  const variation = row.patrimoineNetCents - data.patrimoineNetCents
                  return (
                    <tr key={row.year} className="traj-row">
                      <td className="traj-td">
                        {row.year - new Date().getFullYear()} an{row.year - new Date().getFullYear() > 1 ? "s" : ""}{" "}
                        <span className="traj-year">({row.year})</span>
                      </td>
                      <td className="traj-td">{fmt(row.financierCents)}</td>
                      <td className="traj-td">{fmt(row.immobilierCents)}</td>
                      <td className="traj-td" style={{ color: "var(--danger)" }}>
                        {row.dettesCents > 0 ? `− ${fmt(row.dettesCents)}` : "—"}
                      </td>
                      <td className="traj-td traj-projected">{fmt(row.patrimoineNetCents)}</td>
                      <td className="traj-td" style={{ color: variation >= 0 ? "var(--primary)" : "var(--danger)" }}>
                        {fmtDelta(variation)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 12 }}>
            Hypothèses : {(R_FINANCIER * 100).toFixed(1)} % de rendement financier, +{(R_IMMO * 100).toFixed(1)} %/an sur l'immobilier, amortissement linéaire des crédits, épargne constante de {fmt(data.epargneMenusuelleCents)}/mois.
          </p>
        </div>
      )}
    </div>
  )
}

const R_FINANCIER = 0.05
const R_IMMO = 0.024
