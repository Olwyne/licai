"use client"
import { useState, useEffect, useCallback } from "react"
import { formatCents } from "@/lib/money"
import type { Property, Loan } from "@/db/schema"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Kpis {
  actifBrut: number
  passif: number
  patrimoineNet: number
  plusValue: number
  mensualitesTotales: number
}

interface PatrimoineData {
  properties: Property[]
  loans: Loan[]
  accounts: { totalCents: number }
  kpis: Kpis
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROPERTY_KINDS: { value: string; label: string }[] = [
  { value: "immobilier", label: "Immobilier" },
  { value: "vehicule", label: "Véhicule" },
  { value: "autre", label: "Autre" },
]

const LOAN_KINDS: { value: string; label: string }[] = [
  { value: "immobilier", label: "Immobilier" },
  { value: "auto", label: "Auto" },
  { value: "conso", label: "Conso" },
  { value: "autre", label: "Autre" },
]

function kindLabel(kind: string, list: { value: string; label: string }[]): string {
  return list.find((k) => k.value === kind)?.label ?? kind
}

function parseEuros(str: string): number {
  const n = parseFloat(str.replace(/\s/g, "").replace(",", "."))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

function dateLabel(date: string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

// ─── Property Modal ───────────────────────────────────────────────────────────

interface PropertyModalProps {
  property: Property | null
  onClose: () => void
  onSaved: (p: Property) => void
  onDeleted: (id: string) => void
}

function PropertyModal({ property, onClose, onSaved, onDeleted }: PropertyModalProps) {
  const isEdit = property !== null
  const [name, setName] = useState(property?.name ?? "")
  const [kind, setKind] = useState(property?.kind ?? "immobilier")
  const [valueEuros, setValueEuros] = useState(property ? centsToEuros(property.valueCents) : "")
  const [purchasePriceEuros, setPurchasePriceEuros] = useState(
    property ? centsToEuros(property.purchasePriceCents) : ""
  )
  const [purchaseDate, setPurchaseDate] = useState(property?.purchaseDate ?? "")
  const [note, setNote] = useState(property?.note ?? "")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Le nom est requis."); return }
    setLoading(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        kind,
        valueCents: parseEuros(valueEuros),
        purchasePriceCents: parseEuros(purchasePriceEuros),
        purchaseDate: purchaseDate || null,
        note,
      }
      const res = await fetch(
        isEdit ? `/api/patrimoine/properties/${property.id}` : "/api/patrimoine/properties",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      )
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      const json = (await res.json()) as { data: Property }
      onSaved(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!property) return
    setDeleting(true)
    try {
      await fetch(`/api/patrimoine/properties/${property.id}`, { method: "DELETE" })
      onDeleted(property.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le bien" : "Ajouter un bien"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            <div className="field">
              <label className="">Nom</label>
              <input className="" value={name} onChange={(e) => setName(e.target.value)} placeholder="Appartement Lyon 3e" required />
            </div>
            <div className="field">
              <label className="">Type</label>
              <div className="select" style={{ width: "100%" }}>
                <select className="" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: "100%" }}>
                  {PROPERTY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="">Valeur actuelle (€)</label>
              <input className="" value={valueEuros} onChange={(e) => setValueEuros(e.target.value)} placeholder="280 000" />
            </div>
            <div className="field">
              <label className="">Prix d&apos;achat (€)</label>
              <input className="" value={purchasePriceEuros} onChange={(e) => setPurchasePriceEuros(e.target.value)} placeholder="240 000" />
            </div>
            <div className="field">
              <label className="">Date d&apos;achat</label>
              <input className="" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="">Note</label>
              <input className="" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Résidence principale…" />
            </div>
          </div>
          <div className="modal-foot">
            {isEdit && (
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            )}
            <div className="obj-modal-foot-right">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Loan Modal ───────────────────────────────────────────────────────────────

interface LoanModalProps {
  loan: Loan | null
  onClose: () => void
  onSaved: (l: Loan) => void
  onDeleted: (id: string) => void
}

function LoanModal({ loan, onClose, onSaved, onDeleted }: LoanModalProps) {
  const isEdit = loan !== null
  const [name, setName] = useState(loan?.name ?? "")
  const [kind, setKind] = useState(loan?.kind ?? "immobilier")
  const [principalEuros, setPrincipalEuros] = useState(loan ? centsToEuros(loan.principalCents) : "")
  const [remainingEuros, setRemainingEuros] = useState(loan ? centsToEuros(loan.remainingCents) : "")
  const [monthlyEuros, setMonthlyEuros] = useState(loan ? centsToEuros(loan.monthlyPaymentCents) : "")
  const [rate, setRate] = useState(loan ? String(loan.ratePercent) : "")
  const [endDate, setEndDate] = useState(loan?.endDate ?? "")
  const [note, setNote] = useState(loan?.note ?? "")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Le nom est requis."); return }
    setLoading(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        kind,
        principalCents: parseEuros(principalEuros),
        remainingCents: parseEuros(remainingEuros),
        monthlyPaymentCents: parseEuros(monthlyEuros),
        ratePercent: parseFloat(rate.replace(",", ".")) || 0,
        endDate: endDate || null,
        note,
      }
      const res = await fetch(
        isEdit ? `/api/patrimoine/loans/${loan.id}` : "/api/patrimoine/loans",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      )
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      const json = (await res.json()) as { data: Loan }
      onSaved(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!loan) return
    setDeleting(true)
    try {
      await fetch(`/api/patrimoine/loans/${loan.id}`, { method: "DELETE" })
      onDeleted(loan.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le crédit" : "Ajouter un crédit"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            <div className="field">
              <label className="">Nom</label>
              <input className="" value={name} onChange={(e) => setName(e.target.value)} placeholder="Crédit immobilier" required />
            </div>
            <div className="field">
              <label className="">Type</label>
              <div className="select" style={{ width: "100%" }}>
                <select className="" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: "100%" }}>
                  {LOAN_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="">Montant emprunté (€)</label>
              <input className="" value={principalEuros} onChange={(e) => setPrincipalEuros(e.target.value)} placeholder="180 000" />
            </div>
            <div className="field">
              <label className="">Capital restant dû (€)</label>
              <input className="" value={remainingEuros} onChange={(e) => setRemainingEuros(e.target.value)} placeholder="142 000" />
            </div>
            <div className="field">
              <label className="">Mensualité (€)</label>
              <input className="" value={monthlyEuros} onChange={(e) => setMonthlyEuros(e.target.value)} placeholder="890" />
            </div>
            <div className="field">
              <label className="">Taux (%)</label>
              <input className="" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="2.1" />
            </div>
            <div className="field">
              <label className="">Date de fin</label>
              <input className="" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="">Note</label>
              <input className="" value={note} onChange={(e) => setNote(e.target.value)} placeholder="BNP Paribas…" />
            </div>
          </div>
          <div className="modal-foot">
            {isEdit && (
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            )}
            <div className="obj-modal-foot-right">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PatrimoineClient() {
  const [data, setData] = useState<PatrimoineData | null>(null)
  const [loadError, setLoadError] = useState("")

  const [propertyModal, setPropertyModal] = useState<{ open: boolean; item: Property | null }>({ open: false, item: null })
  const [loanModal, setLoanModal] = useState<{ open: boolean; item: Loan | null }>({ open: false, item: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/patrimoine")
      if (!res.ok) { setLoadError("Impossible de charger les données."); return }
      const json = (await res.json()) as { data: PatrimoineData }
      setData(json.data)
    } catch {
      setLoadError("Erreur réseau.")
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function onPropertySaved(p: Property) {
    setPropertyModal({ open: false, item: null })
    setData((prev) => {
      if (!prev) return prev
      const exists = prev.properties.find((x) => x.id === p.id)
      const props = exists
        ? prev.properties.map((x) => (x.id === p.id ? p : x))
        : [...prev.properties, p]
      return recompute({ ...prev, properties: props })
    })
  }

  function onPropertyDeleted(id: string) {
    setPropertyModal({ open: false, item: null })
    setData((prev) => {
      if (!prev) return prev
      return recompute({ ...prev, properties: prev.properties.filter((x) => x.id !== id) })
    })
  }

  function onLoanSaved(l: Loan) {
    setLoanModal({ open: false, item: null })
    setData((prev) => {
      if (!prev) return prev
      const exists = prev.loans.find((x) => x.id === l.id)
      const loanList = exists
        ? prev.loans.map((x) => (x.id === l.id ? l : x))
        : [...prev.loans, l]
      return recompute({ ...prev, loans: loanList })
    })
  }

  function onLoanDeleted(id: string) {
    setLoanModal({ open: false, item: null })
    setData((prev) => {
      if (!prev) return prev
      return recompute({ ...prev, loans: prev.loans.filter((x) => x.id !== id) })
    })
  }

  if (loadError) {
    return (
      <div className="page-patrimoine">
        <div className="page-header"><h1 className="page-title">Patrimoine</h1></div>
        <div className="empty"><i className="ti ti-alert-circle" />{loadError}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-patrimoine">
        <div className="page-header"><h1 className="page-title">Patrimoine</h1></div>
        <div className="empty"><i className="ti ti-loader" />Chargement…</div>
      </div>
    )
  }

  const { properties: props, loans, kpis } = data
  const netPositive = kpis.patrimoineNet >= 0
  const plusValuePositive = kpis.plusValue >= 0

  return (
    <div className="page-patrimoine">
      <div className="page-header">
        <h1 className="page-title">Patrimoine</h1>
      </div>

      {/* KPI cards */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Patrimoine net</span>
            <div className="metric-ic" style={{ background: netPositive ? "rgba(29,158,117,0.15)" : "rgba(216,90,48,0.15)", color: netPositive ? "var(--primary)" : "var(--danger)" }}>
              <i className="ti ti-scale" />
            </div>
          </div>
          <div className="metric-value num" style={{ color: netPositive ? "var(--primary)" : "var(--danger)" }}>{formatCents(kpis.patrimoineNet)}</div>
          <div className={`metric-sub ${netPositive ? "up" : "down"}`}>
            <i className={`ti ${netPositive ? "ti-trending-up" : "ti-trending-down"}`} />
            {netPositive ? "Bilan positif" : "Bilan négatif"}
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Actif brut</span>
            <div className="metric-ic" style={{ background: "rgba(55,138,221,0.15)", color: "var(--info)" }}>
              <i className="ti ti-building-estate" />
            </div>
          </div>
          <div className="metric-value num">{formatCents(kpis.actifBrut)}</div>
          <div className="metric-sub neutral">
            <i className="ti ti-info-circle" />
            Biens + liquidités
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Passif total</span>
            <div className="metric-ic" style={{ background: "rgba(216,90,48,0.15)", color: "var(--danger)" }}>
              <i className="ti ti-credit-card" />
            </div>
          </div>
          <div className="metric-value num">{formatCents(kpis.passif)}</div>
          <div className="metric-sub neutral">
            <i className="ti ti-calendar" />
            {formatCents(kpis.mensualitesTotales)} / mois
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Plus-value latente</span>
            <div className="metric-ic" style={{ background: plusValuePositive ? "rgba(29,158,117,0.15)" : "rgba(216,90,48,0.15)", color: plusValuePositive ? "var(--primary)" : "var(--danger)" }}>
              <i className="ti ti-chart-line" />
            </div>
          </div>
          <div className="metric-value num" style={{ color: plusValuePositive ? "var(--primary)" : "var(--danger)" }}>{formatCents(kpis.plusValue)}</div>
          <div className={`metric-sub ${plusValuePositive ? "up" : "down"}`}>
            <i className={`ti ${plusValuePositive ? "ti-arrow-up" : "ti-arrow-down"}`} />
            Sur les biens immobiliers
          </div>
        </div>
      </div>

      {/* Properties section */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Biens</span>
          <button className="btn btn-primary btn-sm" onClick={() => setPropertyModal({ open: true, item: null })}>
            <i className="ti ti-plus" /> Ajouter
          </button>
        </div>
        <div>
          {props.length === 0 ? (
            <div className="empty"><i className="ti ti-building" />Aucun bien enregistré</div>
          ) : (
            <div className="pat-list">
              {props.map((p) => {
                const delta = p.valueCents - p.purchasePriceCents
                const positive = delta >= 0
                return (
                  <div key={p.id} className="pat-row" onClick={() => setPropertyModal({ open: true, item: p })}>
                    <div className="pat-info">
                      <span className="pat-badge">{kindLabel(p.kind, PROPERTY_KINDS)}</span>
                      <span className="pat-name">{p.name}</span>
                      {p.purchaseDate && <span className="pat-date">{dateLabel(p.purchaseDate)}</span>}
                    </div>
                    <div className="pat-amounts">
                      <span className="pat-val num">{formatCents(p.valueCents)}</span>
                      <span className={`pat-delta num ${positive ? "up" : "down"}`}>
                        {positive ? "+" : "−"}{formatCents(Math.abs(delta))}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Loans section */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Crédits</span>
          <button className="btn btn-primary btn-sm" onClick={() => setLoanModal({ open: true, item: null })}>
            <i className="ti ti-plus" /> Ajouter
          </button>
        </div>
        <div>
          {loans.length === 0 ? (
            <div className="empty"><i className="ti ti-credit-card" />Aucun crédit enregistré</div>
          ) : (
            <div className="loan-list">
              {loans.map((l) => {
                const pct = l.principalCents > 0 ? Math.round((1 - l.remainingCents / l.principalCents) * 100) : 0
                return (
                  <div key={l.id} className="loan-row" onClick={() => setLoanModal({ open: true, item: l })}>
                    <div className="loan-head">
                      <div className="loan-title-row">
                        <span className="pat-badge">{kindLabel(l.kind, LOAN_KINDS)}</span>
                        <span className="loan-name">{l.name}</span>
                      </div>
                      <div className="loan-info">
                        <span className="loan-rate num">{l.ratePercent} %</span>
                        {l.endDate && <span className="pat-date">fin {dateLabel(l.endDate)}</span>}
                      </div>
                    </div>
                    <div className="loan-bar">
                      <div className="loan-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="loan-foot">
                      <span className="pat-val num">{formatCents(l.remainingCents)} restants</span>
                      <span className="loan-monthly num">{formatCents(l.monthlyPaymentCents)} / mois</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {propertyModal.open && (
        <PropertyModal
          property={propertyModal.item}
          onClose={() => setPropertyModal({ open: false, item: null })}
          onSaved={onPropertySaved}
          onDeleted={onPropertyDeleted}
        />
      )}

      {loanModal.open && (
        <LoanModal
          loan={loanModal.item}
          onClose={() => setLoanModal({ open: false, item: null })}
          onSaved={onLoanSaved}
          onDeleted={onLoanDeleted}
        />
      )}
    </div>
  )
}

// ─── Recompute kpis ───────────────────────────────────────────────────────────

function recompute(d: PatrimoineData): PatrimoineData {
  const actifBrut = d.properties.reduce((s, p) => s + p.valueCents, 0) + d.accounts.totalCents
  const passif = d.loans.reduce((s, l) => s + l.remainingCents, 0)
  const patrimoineNet = actifBrut - passif
  const plusValue = d.properties.reduce((s, p) => s + (p.valueCents - p.purchasePriceCents), 0)
  const mensualitesTotales = d.loans.reduce((s, l) => s + l.monthlyPaymentCents, 0)
  return { ...d, kpis: { actifBrut, passif, patrimoineNet, plusValue, mensualitesTotales } }
}
