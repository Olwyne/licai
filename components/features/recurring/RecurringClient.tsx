"use client"
import { useState, useEffect } from "react"
import { RecurringList } from "./RecurringList"
import { RecurringModal } from "./RecurringModal"
import { Button } from "@/components/ui/Button"
import { formatCents } from "@/lib/money"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"
import type { Recurring, Account, Category, Member, Bank } from "@/db/schema"

type KindFilter = "all" | "charge" | "subscription" | "insurance" | "saving" | "paused"

interface Props {
  initialRecurring: Recurring[]
  accounts: Account[]
  categories: Category[]
  members: Member[]
  banks: Bank[]
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

const KIND_LABELS: Record<string, string> = {
  charge: "Charge fixe",
  subscription: "Abonnement",
  insurance: "Assurance",
  saving: "Épargne auto",
}
const KIND_ICONS: Record<string, string> = {
  charge: "ti-calendar-repeat",
  subscription: "ti-device-tv",
  saving: "ti-pig-money",
}
const KIND_COLORS: Record<string, string> = {
  charge: "#D85A30",
  subscription: "#EF9F27",
  saving: "#1D9E75",
}

function currentMonthLabel(): string {
  const now = new Date()
  return `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`
}

function dayOfMonth(dateStr: string): number {
  return parseInt(dateStr.split("-")[2] ?? "1")
}

function shortMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

export function RecurringClient({
  initialRecurring,
  accounts,
  categories,
  members,
  banks,
}: Props) {
  const [recurringList, setRecurringList] = useState<Recurring[]>(initialRecurring)
  const [filter, setFilter] = useState<KindFilter>("all")
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Recurring | null>(null)
  const [loanMensualitesCents, setLoanMensualitesCents] = useState(0)

  // Fetch loan monthly payments for "Avec les crédits" KPI
  useEffect(() => {
    fetch("/api/credits")
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: { totals?: { mensualitesCents?: number } } } | null) => {
        if (json?.data?.totals?.mensualitesCents) {
          setLoanMensualitesCents(json.data.totals.mensualitesCents)
        }
      })
      .catch(() => {})
  }, [])

  function handleAdded(item: Recurring) {
    setRecurringList((prev) => [item, ...prev])
    setShowModal(false)
  }

  function handleUpdated(item: Recurring) {
    setRecurringList((prev) => prev.map((r) => (r.id === item.id ? item : r)))
    setEditTarget(null)
  }

  function handleDeleted(id: string) {
    setRecurringList((prev) => prev.filter((r) => r.id !== id))
    setEditTarget(null)
  }

  // ── KPI computations ──────────────────────────────────────────────────────

  const active = recurringList.filter(r => r.active)

  const chargesFixesMensuelCents = active
    .filter(r => r.kind !== "saving")
    .reduce((s, r) => s + frequencyToMonthlyCents(Math.abs(r.amountCents), r.frequency as "monthly" | "quarterly" | "annual"), 0)

  const avecCreditsCents = chargesFixesMensuelCents + loanMensualitesCents

  const abonnementsCents = active
    .filter(r => r.kind === "subscription")
    .reduce((s, r) => s + frequencyToMonthlyCents(Math.abs(r.amountCents), r.frequency as "monthly" | "quarterly" | "annual"), 0)

  const epargneCents = active
    .filter(r => r.kind === "saving")
    .reduce((s, r) => s + frequencyToMonthlyCents(Math.abs(r.amountCents), r.frequency as "monthly" | "quarterly" | "annual"), 0)

  // ── Échéancier ─────────────────────────────────────────────────────────────
  // Show active items sorted by day of month (from nextDate)
  const echeancierItems = [...active]
    .sort((a, b) => dayOfMonth(a.nextDate) - dayOfMonth(b.nextDate))

  const echeancierTotal = echeancierItems.reduce((s, r) => s + Math.abs(r.amountCents), 0)

  // ── Par nature ──────────────────────────────────────────────────────────────
  const byKind: Record<string, { count: number; monthlyCents: number }> = {}
  for (const r of active) {
    if (!byKind[r.kind]) byKind[r.kind] = { count: 0, monthlyCents: 0 }
    byKind[r.kind].count++
    byKind[r.kind].monthlyCents += frequencyToMonthlyCents(
      Math.abs(r.amountCents),
      r.frequency as "monthly" | "quarterly" | "annual"
    )
  }

  return (
    <div className="page-recurrent">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dépenses récurrentes</h1>
          <div className="page-sub">Abonnements, assurances et charges fixes</div>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <i className="ti ti-plus" /> Ajouter une dépense récurrente
        </Button>
      </div>

      {/* KPI row */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Charges fixes / mois</span>
            <span className="metric-ic" style={{ background: "#6366F120" }}>
              <i className="ti ti-calendar-repeat" style={{ color: "#6366F1" }} />
            </span>
          </div>
          <div className="metric-value">{formatCents(chargesFixesMensuelCents)}</div>
          <div className="metric-sub neutral">{active.filter(r => r.kind !== "saving").length} prélèvements récurrents</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Avec les crédits</span>
            <span className="metric-ic" style={{ background: "#D85A3020" }}>
              <i className="ti ti-credit-card" style={{ color: "#D85A30" }} />
            </span>
          </div>
          <div className="metric-value">{formatCents(avecCreditsCents)}</div>
          <div className="metric-sub neutral">Charges + mensualités</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Abonnements</span>
            <span className="metric-ic" style={{ background: "#EF9F2720" }}>
              <i className="ti ti-device-tv" style={{ color: "#EF9F27" }} />
            </span>
          </div>
          <div className="metric-value">{formatCents(abonnementsCents)}</div>
          <div className="metric-sub neutral">
            {active.filter(r => r.kind === "subscription").length} actifs · {formatCents(abonnementsCents * 12)} / an
          </div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Épargne automatique</span>
            <span className="metric-ic" style={{ background: "#1D9E7520" }}>
              <i className="ti ti-pig-money" style={{ color: "#1D9E75" }} />
            </span>
          </div>
          <div className="metric-value">{formatCents(epargneCents)}</div>
          <div className="metric-sub neutral">Virements programmés</div>
        </div>
      </div>

      {/* Two-panel layout: Échéancier + Par nature */}
      <div className="rec-panels">
        {/* Échéancier */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Échéancier de {currentMonthLabel()}</span>
            <span className="card-sub">{formatCents(echeancierTotal)}</span>
          </div>
          <div className="rec-echeancier">
            {echeancierItems.length === 0 && (
              <div className="cred-cout-empty">Aucun prélèvement actif</div>
            )}
            {echeancierItems.map((r) => {
              const color = KIND_COLORS[r.kind] ?? "#888780"
              const icon  = KIND_ICONS[r.kind]  ?? "ti-calendar"
              const freqLabel = r.frequency === "monthly" ? "" : r.frequency === "quarterly" ? " trimestriel" : " annuel"
              return (
                <div key={r.id} className="rec-ech-row">
                  <div className="rec-ech-date">{shortMonthDay(r.nextDate)}</div>
                  <span className="rec-ech-icon" style={{ background: color + "22", color }}>
                    <i className={`ti ${icon}`} />
                  </span>
                  <div className="rec-ech-name">
                    {r.name}
                    {freqLabel && <span className="rec-ech-freq">{freqLabel}</span>}
                  </div>
                  <div className="rec-ech-right">
                    <span className="rec-ech-amt">−{formatCents(Math.abs(r.amountCents))}</span>
                    <span className="rec-ech-status">à venir</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Par nature */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Par nature · par mois</span>
          </div>
          <div className="rec-nature-list">
            {Object.entries(byKind).map(([kind, { count, monthlyCents }]) => (
              <div key={kind} className="rec-nature-row">
                <span className="rec-nature-dot" style={{ background: KIND_COLORS[kind] ?? "#888780" }} />
                <div className="rec-nature-body">
                  <div className="rec-nature-label">{KIND_LABELS[kind] ?? kind}</div>
                  <div className="rec-nature-meta">{count} ligne{count !== 1 ? "s" : ""} · {formatCents(monthlyCents * 12)} / an</div>
                </div>
                <div className="rec-nature-val">{formatCents(monthlyCents)}</div>
              </div>
            ))}
            {Object.keys(byKind).length === 0 && (
              <div className="cred-cout-empty">Aucun élément actif</div>
            )}
          </div>
        </div>
      </div>

      {/* Main list */}
      <RecurringList
        items={recurringList}
        accounts={accounts}
        categories={categories}
        banks={banks}
        filter={filter}
        onFilterChange={setFilter}
        onEdit={(item) => setEditTarget(item)}
        onUpdated={handleUpdated}
      />

      {(showModal || editTarget) && (
        <RecurringModal
          item={editTarget}
          accounts={accounts}
          categories={categories}
          members={members}
          onClose={() => {
            setShowModal(false)
            setEditTarget(null)
          }}
          onSaved={editTarget ? handleUpdated : handleAdded}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
