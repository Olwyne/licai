"use client"
import { useState, useEffect } from "react"
import { formatCents } from "@/lib/money"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberResult {
  name: string
  annualGrossCents: number
  abattementCents: number
  netImposableCents: number
  partsFiscales: number
}

interface HouseholdResult {
  totalNetImposableCents: number
  partsFiscales: number
  quotientFamilialCents: number
  irBrutCents: number
  decoteCents: number
  irNetCents: number
  monthlyIrCents: number
  tauxEffectif: number
}

interface BracketResult {
  label: string
  rate: number
  floor: number
  ceiling: number | null
  amountCents: number
}

interface ImpotsData {
  members: MemberResult[]
  household: HouseholdResult
  brackets: BracketResult[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImpotsClient() {
  const [data, setData] = useState<ImpotsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/impots")
      .then((r) => r.json())
      .then((json: { data?: ImpotsData; error?: string }) => {
        if (json.error) {
          setError(json.error)
        } else if (json.data) {
          setData(json.data)
        } else {
          setError("Réponse invalide")
        }
      })
      .catch(() => setError("Impossible de charger les données"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Impôts</h1>
        <p style={{ color: "var(--fg-muted)" }}>Calcul en cours…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-header">
        <h1 className="page-title">Impôts</h1>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { household, members, brackets } = data
  const totalBracketTax = brackets.reduce((s, b) => s + b.amountCents, 0)

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: "20px" }}>
        <div>
          <h1 className="page-title">Impôts</h1>
          <p className="page-sub">Estimation IR · Barème 2024</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics metrics-3">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">IR annuel net</span>
            <span className="metric-ic" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <i className="ti ti-receipt-tax" />
            </span>
          </div>
          <div className="metric-value">{formatCents(household.irNetCents)}</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">IR mensuel</span>
            <span className="metric-ic" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
              <i className="ti ti-calendar-month" />
            </span>
          </div>
          <div className="metric-value">{formatCents(household.monthlyIrCents)}</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Taux effectif</span>
            <span className="metric-ic" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
              <i className="ti ti-percentage" />
            </span>
          </div>
          <div className="metric-value">{household.tauxEffectif.toFixed(1)} %</div>
        </div>
      </div>

      {/* Barème */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Barème progressif 2024</span>
        </div>
        <div className="bareme-list">
          {brackets.map((b) => {
            const pct = totalBracketTax > 0 ? (b.amountCents / totalBracketTax) * 100 : 0
            const rateLabel = `${Math.round(b.rate * 100)} %`
            const ceilLabel =
              b.ceiling !== null
                ? ` → ${formatCents(b.ceiling)}`
                : " → ∞"
            const floorLabel = formatCents(b.floor)

            return (
              <div key={b.label} className="bareme-row">
                <div className="bareme-label">
                  <span style={{ color: "var(--fg-base)", fontWeight: 500 }}>{rateLabel}</span>
                  <span style={{ color: "var(--fg-muted)", fontSize: "11px" }}>
                    {" "}({floorLabel}{ceilLabel})
                  </span>
                </div>
                <div className="bareme-bar">
                  <div
                    className="bareme-fill"
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
                <div className="bareme-amt">{formatCents(b.amountCents)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-member table */}
      {members.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <span className="card-title">Revenus par membre</span>
          </div>
          <table className="impots-table">
            <thead>
              <tr>
                <th className="impots-th">Membre</th>
                <th className="impots-th" style={{ textAlign: "right" }}>Revenu brut annuel</th>
                <th className="impots-th" style={{ textAlign: "right" }}>Abattement 10%</th>
                <th className="impots-th" style={{ textAlign: "right" }}>Net imposable</th>
                <th className="impots-th" style={{ textAlign: "right" }}>Parts</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.name}>
                  <td className="impots-td">{m.name}</td>
                  <td className="impots-td" style={{ textAlign: "right" }}>{formatCents(m.annualGrossCents)}</td>
                  <td className="impots-td" style={{ textAlign: "right", color: "var(--success)" }}>
                    −{formatCents(m.abattementCents)}
                  </td>
                  <td className="impots-td" style={{ textAlign: "right", fontWeight: 500 }}>{formatCents(m.netImposableCents)}</td>
                  <td className="impots-td" style={{ textAlign: "right" }}>{m.partsFiscales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Household synthesis */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Calcul du foyer</span>
        </div>
        <div className="impots-synthesis">
          <SynthesisRow label="Total net imposable" value={formatCents(household.totalNetImposableCents)} />
          <SynthesisRow label="Parts fiscales" value={String(household.partsFiscales)} />
          <SynthesisRow label="Quotient familial" value={formatCents(household.quotientFamilialCents)} />
          <SynthesisRow label="IR brut" value={formatCents(household.irBrutCents)} />
          {household.decoteCents > 0 && (
            <SynthesisRow
              label="Décote"
              value={`−${formatCents(household.decoteCents)}`}
              valueColor="var(--success)"
            />
          )}
          <SynthesisRow
            label="IR net"
            value={formatCents(household.irNetCents)}
            bold
          />
          <SynthesisRow
            label="Mensualité"
            value={formatCents(household.monthlyIrCents)}
            bold
          />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function SynthesisRow({
  label,
  value,
  bold = false,
  valueColor,
}: {
  label: string
  value: string
  bold?: boolean
  valueColor?: string
}) {
  return (
    <div className="synthesis-row">
      <span style={{ color: "var(--fg-secondary)", fontSize: "13.5px" }}>{label}</span>
      <span
        style={{
          fontSize: "13.5px",
          fontWeight: bold ? 600 : 400,
          color: valueColor ?? "var(--fg-base)",
        }}
      >
        {value}
      </span>
    </div>
  )
}
