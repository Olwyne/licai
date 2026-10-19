"use client"
import { useState, useEffect, useCallback } from "react"
import { formatCents, parseCents } from "@/lib/money"
import type { Loan } from "@/db/schema"
import { LoanModal } from "./LoanModal"
import { useFinanceContext } from "@/components/features/finance/useFinanceContext"
import { StatRow } from "@/components/features/finance/ui"
import { capacity, DEFAULT_CAPACITY, type CapacityInputs } from "@/lib/finance/credit"
import { eur, pc } from "@/lib/finance/format"
import { AmortModal } from "./AmortModal"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedLoan extends Loan {
  echeancesRestantes: number
  interetsRestantsCents: number
  pctRembourse: number
}

interface Totals {
  detteTotaleCents: number
  mensualitesCents: number
  tauxMoyenPondere: number
  tauxEndettement: number | null
  totalInteretsCents: number
  count: number
}

interface CreditsData {
  loans: EnrichedLoan[]
  totals: Totals
}

type KindFilter = "tous" | "immobilier" | "auto" | "travaux" | "conso"

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  immobilier: "Immobilier",
  auto: "Auto",
  travaux: "Travaux",
  conso: "Consommation",
  autre: "Autre",
}

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "tous",       label: "Tous" },
  { value: "immobilier", label: "Immobilier" },
  { value: "auto",       label: "Auto" },
  { value: "travaux",    label: "Travaux" },
  { value: "conso",      label: "Consommation" },
]

// ─── Capacité d'emprunt (deux méthodes, limite HCSF) ─────────────────────────

const CAP_KEY = "licai-capacity"

function CapaciteEmprunt() {
  const { ctx } = useFinanceContext()
  const [c, setC] = useState<CapacityInputs>(DEFAULT_CAPACITY)
  const [raw, setRaw] = useState({ rate: "3,4", years: "20", apport: "30000" })

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CAP_KEY) ?? "null") as CapacityInputs | null
      if (v && v.rate > 0) { setC(v); setRaw({ rate: String(v.rate).replace(".", ","), years: String(v.years), apport: String(Math.round(v.apport)) }) }
    } catch { /* valeurs par défaut */ }
  }, [])

  function commit(next: typeof raw) {
    setRaw(next)
    const n = (x: string) => parseFloat(x.replace(/\s/g, "").replace(",", ".")) || 0
    const v = { rate: n(next.rate) || DEFAULT_CAPACITY.rate, years: Math.min(25, Math.max(5, Math.round(n(next.years)) || DEFAULT_CAPACITY.years)), apport: n(next.apport) }
    setC(v)
    try { localStorage.setItem(CAP_KEY, JSON.stringify(v)) } catch { /* stockage indisponible */ }
  }

  if (!ctx) return <div className="card"><div className="empty"><i aria-hidden="true" className="ti ti-loader" />Chargement…</div></div>
  const K = capacity(ctx, c)
  const field = (label: string, k: keyof typeof raw, unit: string, inputMode: "decimal" | "numeric") => (
    <div className="fi-field"><label>{label}</label>
      <div className="field-amount"><input type="text" inputMode={inputMode} value={raw[k]} onChange={(e) => commit({ ...raw, [k]: e.target.value })} /><span className="cur">{unit}</span></div></div>
  )
  const nextEnd = ctx.loans.filter((l) => l.kind === "auto" && l.endDate)[0]

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Capacité d&apos;emprunt</span>
        <span className="card-sub">Limite HCSF : 35 % de charges, 25 ans maximum</span>
      </div>
      <div className="fi-grid three">
        {field("Taux envisagé", "rate", "%", "decimal")}
        {field("Durée", "years", "ans", "numeric")}
        {field("Apport disponible", "apport", "€", "decimal")}
      </div>
      <div className="stat-list" style={{ marginTop: 6 }}>
        <StatRow label="Taux d'endettement — méthode classique" value={pc(K.ratioClassic, 1)} hint={`Loyers pondérés à 70 % · ${eur(K.revClassic)} de revenus retenus`} cls={K.ratioClassic > 35 ? "neg" : "pos"} />
        <StatRow label="Taux d'endettement — méthode différentiel" value={pc(K.ratioDiff, 1)} hint={`Le locatif s'autofinance · ${eur(K.revDiff)} de revenus retenus`} cls={K.ratioDiff > 35 ? "neg" : "pos"} />
        <StatRow label="Mensualité supplémentaire admissible" value={K.best > 0 ? eur(K.best) : "0 €"} hint={K.best > 0 ? "Sur la méthode la plus favorable" : "Les 35 % sont déjà atteints"} cls={K.best > 0 ? "pos" : "neg"} />
        <StatRow label="Capital empruntable" value={eur(K.borrow)} hint={`Sur ${c.years} ans à ${pc(c.rate, 2)}`} />
        <StatRow label={<b>Budget d&apos;acquisition</b>} value={eur(K.budget)} hint={`Avec ${eur(c.apport)} d'apport, frais de notaire et garantie déduits (≈ 7,5 %)`} />
      </div>
      {K.best <= 0 && (
        <div className="disclaimer sm"><i aria-hidden="true" className="ti ti-alert-triangle" /> <span>Aucune capacité résiduelle avec la méthode classique : rembourser {eur(Math.max(0, K.charges - K.revClassic * 0.35))} de mensualités{nextEnd ? `, ou attendre la fin de ${nextEnd.name} pour libérer de la marge` : ""}.</span></div>
      )}
    </div>
  )
}

// ─── Loan Card ────────────────────────────────────────────────────────────────

interface LoanCardProps {
  loan: EnrichedLoan
  onClick: () => void
  onAmort: () => void
}

function LoanCard({ loan, onClick, onAmort }: LoanCardProps) {
  return (
    <div className="cred-card" onClick={onClick}>
      <div className="cred-card-header">
        <div>
          <div className="cred-card-name">{loan.name}</div>
          <div className="cred-card-meta">
            {KIND_LABELS[loan.kind] ?? loan.kind} · {loan.ratePercent} %
            {loan.endDate ? ` → ${formatEndDate(loan.endDate)}` : ""}
          </div>
        </div>
      </div>

      <div className="cred-card-kpis">
        <div className="cred-kpi">
          <div className="cred-kpi-label">CAPITAL RESTANT</div>
          <div className="cred-kpi-value">{formatCents(loan.remainingCents)}</div>
        </div>
        <div className="cred-kpi">
          <div className="cred-kpi-label">MENSUALITÉ</div>
          <div className="cred-kpi-value">{formatCents(loan.monthlyPaymentCents)}</div>
        </div>
        <div className="cred-kpi">
          <div className="cred-kpi-label">ÉCHÉANCES RESTANTES</div>
          <div className="cred-kpi-value">{loan.echeancesRestantes}</div>
        </div>
      </div>

      <div className="cred-progress-wrap">
        <div className="cred-progress-bar">
          <div className="cred-progress-fill" style={{ width: `${loan.pctRembourse}%` }} />
        </div>
        <div className="cred-progress-labels">
          <span>{loan.pctRembourse} % remboursé sur {formatCents(loan.principalCents)}</span>
          <span className="cred-interets">Intérêts restants ≈ {formatCents(loan.interetsRestantsCents)}</span>
        </div>
      </div>

      {loan.note && (
        <div className="cred-card-note">{loan.note}</div>
      )}
      <div className="cred-links" style={{ marginTop: 10 }}>
        <button type="button" className="cred-link amort-btn" onClick={(e) => { e.stopPropagation(); onAmort() }}>
          <i aria-hidden="true" className="ti ti-table" /> Tableau &amp; anticipé
        </button>
      </div>
    </div>
  )
}

function formatEndDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CreditsClient() {
  const [data, setData]     = useState<CreditsData | null>(null)
  const [loadErr, setLoadErr] = useState("")
  const [kindFilter, setKindFilter] = useState<KindFilter>("tous")
  const [amort, setAmort] = useState<Loan | null>(null)
  const [modal, setModal]   = useState<{ open: boolean; loan: EnrichedLoan | null }>({ open: false, loan: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/credits")
      if (!res.ok) { setLoadErr("Impossible de charger les crédits."); return }
      const json = (await res.json()) as { data: CreditsData }
      setData(json.data)
    } catch {
      setLoadErr("Erreur réseau.")
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function onSaved() { setModal({ open: false, loan: null }); void load() }

  if (loadErr) return (
    <div className="page-credits">
      <div className="page-header"><h1 className="page-title">Crédits</h1></div>
      <div className="empty"><i aria-hidden="true" className="ti ti-alert-circle" />{loadErr}</div>
    </div>
  )

  if (!data) return (
    <div className="page-credits">
      <div className="page-header"><h1 className="page-title">Crédits</h1></div>
      <div className="empty"><i aria-hidden="true" className="ti ti-loader" />Chargement…</div>
    </div>
  )

  const { loans: loanList, totals } = data

  const filtered = loanList.filter((l) =>
    kindFilter === "tous" ? true : l.kind === kindFilter
  )

  return (
    <div className="page-credits">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Crédits</h1>
          <div className="page-sub">Prêts en cours, comptes prélevés et biens financés</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, loan: null })}>
          <i aria-hidden="true" className="ti ti-plus" /> Ajouter un crédit
        </button>
      </div>

      {/* KPIs */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Dette totale</span>
            <span className="metric-ic" style={{ background: "#D85A3020" }}>
              <i aria-hidden="true" className="ti ti-credit-card" style={{ color: "#D85A30" }} />
            </span>
          </div>
          <div className="metric-value">{formatCents(totals.detteTotaleCents)}</div>
          <div className="metric-sub neutral">{totals.count} crédit{totals.count !== 1 ? "s" : ""} en cours</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Mensualités</span>
            <span className="metric-ic" style={{ background: "#6366F120" }}>
              <i aria-hidden="true" className="ti ti-calendar-repeat" style={{ color: "#6366F1" }} />
            </span>
          </div>
          <div className="metric-value">{formatCents(totals.mensualitesCents)}</div>
          <div className="metric-sub neutral">par mois</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Taux moyen pondéré</span>
            <span className="metric-ic" style={{ background: "#1D9E7520" }}>
              <i aria-hidden="true" className="ti ti-trending-up" style={{ color: "#1D9E75" }} />
            </span>
          </div>
          <div className="metric-value">{totals.tauxMoyenPondere.toFixed(2)} %</div>
          <div className="metric-sub neutral">Sur le capital restant dû</div>
        </div>
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Taux d&apos;endettement</span>
            <span className="metric-ic" style={{ background: "#EF9F2720" }}>
              <i aria-hidden="true" className="ti ti-scale" style={{ color: "#EF9F27" }} />
            </span>
          </div>
          <div className="metric-value">
            {totals.tauxEndettement !== null
              ? `${totals.tauxEndettement.toFixed(1)} %`
              : "—"}
          </div>
          <div className="metric-sub neutral">Méthode HCSF · loyers à 70 %</div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="cred-panels">
        <CapaciteEmprunt />

        {/* Coût de la dette */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Coût de la dette</span>
            <span className="card-sub">Intérêts restants à payer</span>
          </div>
          <div className="cred-cout-list">
            {loanList.map((loan) => (
              <div key={loan.id} className="cred-cout-row">
                <div>
                  <div className="cred-cout-name">{loan.name}</div>
                  <div className="cred-cout-meta">
                    {loan.ratePercent} % · {loan.echeancesRestantes} échéances
                  </div>
                </div>
                <div className="cred-cout-val">{formatCents(loan.interetsRestantsCents)}</div>
              </div>
            ))}
            {loanList.length > 0 && (
              <>
              <div className="cred-cout-row cred-cout-total">
                <div className="cred-cout-name">Total intérêts<div className="cred-cout-meta">Soit {totals.detteTotaleCents ? ((totals.totalInteretsCents / totals.detteTotaleCents) * 100).toFixed(1).replace(".", ",") : "0"} % du capital restant dû</div></div>
                <div className="cred-cout-val">{formatCents(totals.totalInteretsCents)}</div>
              </div>
              <div className="cred-cout-row">
                <div className="cred-cout-name">Assurances emprunteur<div className="cred-cout-meta">Sur la durée résiduelle</div></div>
                <div className="cred-cout-val">{formatCents(loanList.reduce((sum, l) => sum + l.insuranceCents * l.echeancesRestantes, 0))}</div>
              </div>
              </>
            )}
            {loanList.length === 0 && (
              <div className="cred-cout-empty">Aucun crédit enregistré</div>
            )}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="al-chips">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`chip${kindFilter === f.value ? " active" : ""}`}
            onClick={() => setKindFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loan cards */}
      <div className="cred-list">
        {filtered.length === 0 && (
          <div className="empty">
            <i aria-hidden="true" className="ti ti-seeding" />
            {loanList.length === 0
              ? "Aucun crédit. Ajoutez-en un !"
              : "Aucun crédit dans cette catégorie."}
          </div>
        )}
        {filtered.map((loan) => (
          <LoanCard
            key={loan.id}
            loan={loan}
            onClick={() => setModal({ open: true, loan })}
            onAmort={() => setAmort(loan)}
          />
        ))}
      </div>

      {modal.open && (
        <LoanModal
          loan={modal.loan}
          onClose={() => setModal({ open: false, loan: null })}
          onDone={onSaved}
        />
      )}

      {amort && <AmortModal loan={amort} onClose={() => setAmort(null)} />}
    </div>
  )
}
