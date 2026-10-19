"use client"
import { useFetch } from "@/lib/use-fetch"
import { useState } from "react"
import { Chip } from "@/components/ui/Chip"
import { BarChart } from "@/components/charts/BarChart"
import Link from "next/link"
import { formatCents } from "@/lib/money"
import type { PrevisionData, MonthForecast } from "@/app/api/previsions/route"

type Horizon = 6 | 12 | 24

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 6, label: "6 mois" },
  { value: 12, label: "12 mois" },
  { value: 24, label: "24 mois" },
]

const MONTHS_FR = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."]

function shortLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return `${MONTHS_FR[m - 1]} ${String(y).slice(2)}`
}

function longLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return `${MONTHS_FR[m - 1]} ${y}`
}

function sign(n: number): string { return n >= 0 ? `+ ${formatCents(n)}` : `− ${formatCents(Math.abs(n))}` }

export function PrevisionClient() {
  const [horizon, setHorizon] = useState<Horizon>(12)
  const { data, loading } = useFetch<PrevisionData>(`/api/previsions?horizon=${horizon}`)

  const months = data?.months ?? []
  const kpi    = data?.kpi

  // Events to anticipate: all months, all quarterly/annual + exceptional
  const allEvents = months.flatMap(m =>
    m.recurringEvents
      .filter(e => e.amountCents > 0 ? false : true) // expenses only — wait, all events are expenses here
      .map(e => ({ ...e, month: m.month }))
  ).slice(0, 10)

  // Chart
  const barLabels = months.map(m => shortLabel(m.month))
  const barSeries = [
    { label: "Entrées",  data: months.map(m => Math.round(m.incomeCents / 100)),           color: "#1D9E75" },
    { label: "Sorties",  data: months.map(m => Math.round((m.chargesFixesCents + m.variableCents + m.exceptionnelCents + m.epargne) / 100)), color: "#D85A30" },
  ]

  return (
    <div className="page-previsions">
      <div className="page-header">
        <div>
          <h1 className="page-title">Prévisions</h1>
          <div className="page-sub">Trésorerie à {horizon} mois, événements à venir et dérive du budget</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="chips">
            {HORIZONS.map(h => (
              <Chip key={h.value} active={horizon === h.value} onClick={() => setHorizon(h.value)}>
                {h.label}
              </Chip>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => window.open("/rapport", "_blank")}>
            <i aria-hidden="true" className="ti ti-report" /> Rapport
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Solde projeté</span>
            <span className="metric-ic" style={{ background: "#1D9E7520" }}><i aria-hidden="true" className="ti ti-coin-euro" style={{ color: "#1D9E75" }} /></span>
          </div>
          <div className="metric-value" style={{ color: kpi && kpi.soldeProjete >= 0 ? "var(--primary, #1D9E75)" : "var(--danger)" }}>
            {loading ? "—" : kpi ? formatCents(kpi.soldeProjete) : "—"}
          </div>
          <div className="metric-sub neutral">
            {kpi ? `départ ${formatCents(kpi.tresorerieCents)}` : ""}
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Mois le plus tendu</span>
            <span className="metric-ic" style={{ background: "#EF9F2720" }}><i aria-hidden="true" className="ti ti-alert-triangle" style={{ color: "#EF9F27" }} /></span>
          </div>
          <div className="metric-value metric-value--sm" style={{ color: "var(--accent, #EF9F27)" }}>
            {loading ? "—" : kpi?.moisLePlusTendu ? longLabel(kpi.moisLePlusTendu) : "—"}
          </div>
          <div className="metric-sub neutral">
            {kpi ? `${formatCents(kpi.soldeMoisTendu)} au plus bas · matelas ${formatCents(kpi.matelasConseille)}` : ""}
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Dépenses exceptionnelles</span>
            <span className="metric-ic" style={{ background: "#6366F120" }}><i aria-hidden="true" className="ti ti-calendar-event" style={{ color: "#6366F1" }} /></span>
          </div>
          <div className="metric-value">
            {loading ? "—" : kpi ? formatCents(kpi.depensesExceptionnellesCents) : "—"}
          </div>
          <div className="metric-sub neutral">
            sur {horizon} mois
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Épargne placée</span>
            <span className="metric-ic" style={{ background: "#1D9E7520" }}><i aria-hidden="true" className="ti ti-pig-money" style={{ color: "#1D9E75" }} /></span>
          </div>
          <div className="metric-value" style={{ color: "var(--primary)" }}>
            {loading ? "—" : kpi ? formatCents(kpi.epargneTotaleCents) : "—"}
          </div>
          <div className="metric-sub neutral">vers les placements</div>
        </div>
      </div>

      {/* Chart + events */}
      <div className="grid-7-5">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Trésorerie prévisionnelle</div>
            <span className="card-hint">Entrées, sorties et solde du compte</span>
          </div>
          <div className="prevision-chart">
            {!loading && months.length > 0 && <BarChart labels={barLabels} series={barSeries} />}
            {loading && <p className="text-secondary">Chargement…</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Événements à anticiper</div>
          </div>
          <div className="stat-list">
            {loading && <p className="text-secondary">Chargement…</p>}
            {!loading && allEvents.length === 0 && <p className="text-secondary">Aucun événement.</p>}
            {allEvents.map((e, i) => (
              <div className="stat-row" key={i}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-secondary)", marginTop: 1 }}>{longLabel(e.month)}</div>
                </div>
                <div className="stat-val" style={{ color: e.amountCents >= 0 ? "var(--primary)" : "var(--fg)" }}>
                  {formatCents(Math.abs(e.amountCents))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Détail mois par mois */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Détail mois par mois</div>
          <span className="card-hint">Récurrents, crédits, saisonnalité et exceptionnels</span>
        </div>
        <div className="table-scroll">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Entrées</th>
                <th>Charges fixes</th>
                <th>Variable</th>
                <th>Exceptionnel</th>
                <th>Épargne</th>
                <th>Net</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-secondary">Chargement…</td></tr>}
              {months.map((m: MonthForecast) => (
                <tr key={m.month}>
                  <td>{longLabel(m.month)}</td>
                  <td style={{ color: "var(--primary)" }}>{formatCents(m.incomeCents)}</td>
                  <td>{formatCents(m.chargesFixesCents)}</td>
                  <td>{formatCents(m.variableCents)}</td>
                  <td>{m.exceptionnelCents > 0 ? formatCents(m.exceptionnelCents) : "—"}</td>
                  <td style={{ color: "var(--primary)" }}>{formatCents(m.epargne)}</td>
                  <td className="fw-600" style={{ color: m.netCents >= 0 ? "var(--primary)" : "var(--danger)" }}>
                    {sign(m.netCents)}
                  </td>
                  <td className="fw-600">{formatCents(m.runningBalanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget vs réel */}
      {data?.budgetVsReel && data.budgetVsReel.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Budget vs réel · dérive glissante</div>
            <span className="card-hint">Moyenne des 3 derniers mois comparée au plafond</span>
            <Link className="card-link" href="/budget">Modifier les plafonds</Link>
          </div>
          <div className="bvr-list">
            {data.budgetVsReel.map(b => {
              const remain = b.limitCents - b.avgSpentCents
              const over   = remain < 0
              const pct    = b.limitCents > 0 ? Math.round((b.avgSpentCents / b.limitCents) * 100) : 0
              return (
                <div key={b.categoryId} className="bvr-row">
                  <div className="bvr-left">
                    <div className="bvr-label">{b.label}</div>
                    <div className="bvr-avg">{formatCents(b.avgSpentCents)} <span className="bvr-limit">/ {formatCents(b.limitCents)}</span></div>
                  </div>
                  <div className="bvr-bar-wrap">
                    <div className="bar-bg">
                      <div className={`bar-fill ${over ? "over" : pct > 80 ? "warn" : "ok"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className={`bvr-remain ${over ? "text-danger" : "text-ok"}`}>
                    {over ? `+${formatCents(Math.abs(remain))}` : `${formatCents(remain)} restants`}
                  </div>
                  <div className={`bvr-trend bvr-trend--${b.trend}`}>
                    {b.trend === "up" ? "↑ en hausse" : b.trend === "down" ? "↓ en baisse" : "→ stable"}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
