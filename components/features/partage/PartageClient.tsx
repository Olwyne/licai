"use client"
import { useEffect, useState } from "react"
import { formatCents } from "@/lib/money"

type MemberStat = {
  id: string
  name: string
  short: string
  colorHex: string
  incomeCents: number
  expenseCents: number
  shareOfCommonCents: number
  balanceCents: number
}

type IncomeSplit = {
  memberId: string
  name: string
  pct: number
  amountCents: number
}

type Transfer = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amountCents: number
}

type PartageData = {
  month: string
  members: MemberStat[]
  commonExpensesTotalCents: number
  transfers: Transfer[]
  incomeSplit: IncomeSplit[]
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

export function PartageClient() {
  const [data, setData] = useState<PartageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/partage")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setData(json.data as PartageData)
        else setError(json.error ?? "Erreur inconnue")
      })
      .catch(() => setError("Impossible de charger les données"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-partage">
        <div className="page-header">
          <h1 className="page-title">Répartition du foyer</h1>
        </div>
        <div className="empty">Chargement…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page-partage">
        <div className="page-header">
          <h1 className="page-title">Répartition du foyer</h1>
        </div>
        <div className="empty">{error ?? "Aucune donnée"}</div>
      </div>
    )
  }

  const { month, members, commonExpensesTotalCents, transfers, incomeSplit } = data
  const totalIncome = incomeSplit.reduce((s, x) => s + x.amountCents, 0)

  return (
    <div className="page-partage">
      {/* Topbar */}
      <div className="page-header">
        <h1 className="page-title">Répartition du foyer</h1>
        <span className="page-subtitle">{monthLabel(month)}</span>
      </div>

      {/* Row 1: two-column grid */}
      <div className="grid-7-5">
        {/* Left: Revenus du foyer */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenus du foyer</span>
            <span className="card-subtitle">{formatCents(totalIncome)}</span>
          </div>
          <div className="split-bar">
            {incomeSplit.map((s) => (
              <div
                key={s.memberId}
                className="split-segment"
                style={{
                  width: `${s.pct}%`,
                  background: s.pct > 0 ? members.find((m) => m.id === s.memberId)?.colorHex ?? "#888" : undefined,
                }}
                title={`${s.name} — ${s.pct}%`}
              />
            ))}
          </div>
          <div className="split-legend">
            {incomeSplit.map((s) => {
              const member = members.find((m) => m.id === s.memberId)
              return (
                <div key={s.memberId} className="split-legend-row">
                  <span
                    className="split-dot"
                    style={{ background: member?.colorHex ?? "#888" }}
                  />
                  <span className="split-legend-name">{s.name}</span>
                  <span className="split-legend-amt">{formatCents(s.amountCents)}</span>
                  <span className="split-legend-pct">{s.pct} %</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Clé de répartition */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clé de répartition</span>
          </div>
          <div className="key-list">
            {incomeSplit.map((s) => {
              const member = members.find((m) => m.id === s.memberId)
              return (
                <div key={s.memberId} className="key-row">
                  <span className="key-name">{s.name}</span>
                  <div className="key-bar-wrap">
                    <div
                      className="key-bar"
                      style={{ width: `${s.pct}%`, background: member?.colorHex ?? "#888" }}
                    />
                  </div>
                  <span className="key-pct">{s.pct} %</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Soldes du mois */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Soldes du mois</span>
          <span className="card-subtitle">
            Dépenses communes : {formatCents(commonExpensesTotalCents)}
          </span>
        </div>
        <div className="bal-grid">
          {members.map((m) => (
            <div key={m.id} className="bal-card">
              <div className="bal-head">
                <span
                  className="mini-av"
                  style={{
                    background: m.colorHex + "22",
                    color: m.colorHex,
                    borderColor: m.colorHex + "55",
                  }}
                >
                  {m.short}
                </span>
                <span className="bal-name">{m.name}</span>
              </div>
              <div className="bal-nums">
                <div className="bal-row">
                  <span className="bal-label">Revenus</span>
                  <span className="bal-val pos">{formatCents(m.incomeCents)}</span>
                </div>
                <div className="bal-row">
                  <span className="bal-label">Dépenses</span>
                  <span className="bal-val neg">{formatCents(m.expenseCents)}</span>
                </div>
                <div className="bal-row">
                  <span className="bal-label">Part commune</span>
                  <span className="bal-val neg">{formatCents(m.shareOfCommonCents)}</span>
                </div>
                <div className="bal-row bal-row-total">
                  <span className="bal-label">Solde</span>
                  <span
                    className="bal-val"
                    style={{ color: m.balanceCents >= 0 ? "var(--primary)" : "var(--danger)" }}
                  >
                    {formatCents(m.balanceCents)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Virements suggérés */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Virements suggérés</span>
        </div>
        {transfers.length === 0 ? (
          <div className="empty">Tout est équilibré ✓</div>
        ) : (
          <div className="tr-list">
            {transfers.map((t, i) => (
              <div key={i} className="tr-row">
                <div className="tr-name">
                  {t.fromName}
                  <span className="tr-arrow"> → </span>
                  {t.toName}
                </div>
                <div className="tr-sub">
                  {t.fromName} doit {formatCents(t.amountCents)} à {t.toName}
                </div>
                <div className="tr-amt">{formatCents(t.amountCents)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
