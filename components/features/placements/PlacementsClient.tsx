"use client"
import { useState, useEffect, useCallback } from "react"
import { formatCents } from "@/lib/money"
import { DonutChart } from "@/components/charts/DonutChart"

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvestmentRow {
  id: string
  householdId: string
  name: string
  ticker: string
  kind: string
  quantity: number
  unitPriceCents: number
  purchasePriceCents: number
  note: string
  createdAt: string
  currentValueCents: number
  purchaseValueCents: number
  gainCents: number
  gainPct: number
}

interface AllocationItem {
  kind: string
  valueCents: number
  pct: number
}

interface Totals {
  totalValueCents: number
  totalPurchaseCents: number
  totalGainCents: number
  totalGainPct: number
}

interface PlacementsData {
  investments: InvestmentRow[]
  totals: Totals
  allocation: AllocationItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  etf: "ETF",
  action: "Action",
  fonds: "Fonds",
  crypto: "Crypto",
  autre: "Autre",
}

const KIND_COLORS: Record<string, string> = {
  etf: "#1D9E75",
  action: "#378ADD",
  fonds: "#7C6BD6",
  crypto: "#EF9F27",
  autre: "#888780",
}

const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseEuros(str: string): number {
  const n = parseFloat(str.replace(/\s/g, "").replace(",", "."))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

function fmtPct(pct: number): string {
  const s = pct.toFixed(1) + "%"
  return pct >= 0 ? "+" + s : s
}

// ─── Investment Modal ─────────────────────────────────────────────────────────

interface InvestmentModalProps {
  investment: InvestmentRow | null
  onClose: () => void
  onSaved: (inv: InvestmentRow) => void
  onDeleted: (id: string) => void
}

function InvestmentModal({ investment, onClose, onSaved, onDeleted }: InvestmentModalProps) {
  const isEdit = investment !== null
  const [name, setName] = useState(investment?.name ?? "")
  const [ticker, setTicker] = useState(investment?.ticker ?? "")
  const [kind, setKind] = useState(investment?.kind ?? "etf")
  const [quantityStr, setQuantityStr] = useState(investment ? String(investment.quantity) : "")
  const [unitPriceStr, setUnitPriceStr] = useState(investment ? centsToEuros(investment.unitPriceCents) : "")
  const [purchasePriceStr, setPurchasePriceStr] = useState(investment ? centsToEuros(investment.purchasePriceCents) : "")
  const [note, setNote] = useState(investment?.note ?? "")
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
        ticker: ticker.trim(),
        kind,
        quantity: parseFloat(quantityStr.replace(",", ".")) || 0,
        unitPriceCents: parseEuros(unitPriceStr),
        purchasePriceCents: parseEuros(purchasePriceStr),
        note,
      }
      const res = await fetch(
        isEdit ? `/api/placements/${investment.id}` : "/api/placements",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      )
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      const json = (await res.json()) as { data: InvestmentRow }
      onSaved(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!investment) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/placements/${investment.id}`, { method: "DELETE" })
      if (!res.ok) { setError("Erreur lors de la suppression."); return }
      onDeleted(investment.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le placement" : "Ajouter un placement"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i className="ti ti-alert-circle" /> {error}</div>}
            <div className="field">
              <label>Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="MSCI World ETF" required />
            </div>
            <div className="field">
              <label>Ticker</label>
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="CW8" />
            </div>
            <div className="field">
              <label>Type</label>
              <div className="select w-full">
                <select className="w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Quantité</label>
              <input value={quantityStr} onChange={(e) => setQuantityStr(e.target.value)} placeholder="10" />
            </div>
            <div className="field">
              <label>Prix unitaire actuel (€)</label>
              <input value={unitPriceStr} onChange={(e) => setUnitPriceStr(e.target.value)} placeholder="423.00" />
            </div>
            <div className="field">
              <label>Prix d&apos;achat moyen (€)</label>
              <input value={purchasePriceStr} onChange={(e) => setPurchasePriceStr(e.target.value)} placeholder="381.00" />
            </div>
            <div className="field">
              <label>Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Boursobank PEA…" />
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

export function PlacementsClient() {
  const [data, setData] = useState<PlacementsData | null>(null)
  const [loadError, setLoadError] = useState("")
  const [modal, setModal] = useState<{ open: boolean; item: InvestmentRow | null }>({ open: false, item: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/placements")
      if (!res.ok) { setLoadError("Impossible de charger les placements."); return }
      const json = (await res.json()) as { data: PlacementsData }
      setData(json.data)
    } catch {
      setLoadError("Erreur réseau.")
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function onSaved(inv: InvestmentRow) {
    setModal({ open: false, item: null })
    void load()
  }

  function onDeleted(id: string) {
    setModal({ open: false, item: null })
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, investments: prev.investments.filter((x) => x.id !== id) }
    })
    void load()
  }

  if (loadError) {
    return (
      <div className="page-placements">
        <div className="page-header"><h1 className="page-title">Placements</h1></div>
        <div className="empty"><i className="ti ti-alert-circle" />{loadError}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-placements">
        <div className="page-header"><h1 className="page-title">Placements</h1></div>
        <div className="empty"><i className="ti ti-loader" />Chargement…</div>
      </div>
    )
  }

  const { investments: invs, totals, allocation } = data
  const gainPos = totals.totalGainCents >= 0

  const donutSlices = allocation.map((a) => ({
    label: KIND_LABELS[a.kind] ?? a.kind,
    value: a.valueCents,
    color: KIND_COLORS[a.kind] ?? "#888780",
  }))

  return (
    <div className="page-placements">
      <div className="page-header">
        <h1 className="page-title">Placements</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setModal({ open: true, item: null })}
        >
          <i className="ti ti-plus" /> Ajouter
        </button>
      </div>

      {/* KPI cards */}
      <div className="metrics metrics-3">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Valeur totale</span>
            <div className="metric-ic" style={{ background: "rgba(55,138,221,0.15)", color: "var(--info)" }}>
              <i className="ti ti-chart-pie" />
            </div>
          </div>
          <div className="metric-value num">{formatCents(totals.totalValueCents)}</div>
          <div className="metric-sub neutral">
            <i className="ti ti-info-circle" />
            {invs.length} ligne{invs.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Plus-value totale</span>
            <div className="metric-ic" style={{ background: gainPos ? "rgba(29,158,117,0.15)" : "rgba(216,90,48,0.15)", color: gainPos ? "var(--primary)" : "var(--danger)" }}>
              <i className="ti ti-trending-up" />
            </div>
          </div>
          <div className="metric-value num" style={{ color: gainPos ? "var(--primary)" : "var(--danger)" }}>
            {gainPos ? "+" : ""}{formatCents(totals.totalGainCents)}
          </div>
          <div className={`metric-sub ${gainPos ? "up" : "down"}`}>
            <i className={`ti ${gainPos ? "ti-arrow-up" : "ti-arrow-down"}`} />
            Vs prix d&apos;achat
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Performance</span>
            <div className="metric-ic" style={{ background: gainPos ? "rgba(29,158,117,0.15)" : "rgba(216,90,48,0.15)", color: gainPos ? "var(--primary)" : "var(--danger)" }}>
              <i className="ti ti-percentage" />
            </div>
          </div>
          <div className="metric-value num" style={{ color: gainPos ? "var(--primary)" : "var(--danger)" }}>
            {fmtPct(totals.totalGainPct)}
          </div>
          <div className={`metric-sub ${gainPos ? "up" : "down"}`}>
            <i className={`ti ${gainPos ? "ti-trending-up" : "ti-trending-down"}`} />
            Rendement global
          </div>
        </div>
      </div>

      {/* Donut + table */}
      <div className="plac-layout">
        {donutSlices.length > 0 && (
          <div className="plac-donut">
            <div className="section-title">Répartition</div>
            <DonutChart slices={donutSlices} />
            <div className="plac-legend">
              {allocation.map((a) => (
                <div key={a.kind} className="plac-legend-row">
                  <span className="plac-legend-dot" style={{ background: KIND_COLORS[a.kind] ?? "#888780" }} />
                  <span className="plac-legend-label">{KIND_LABELS[a.kind] ?? a.kind}</span>
                  <span className="plac-legend-pct">{a.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="plac-table-wrap">
          <div className="section-title">Portefeuille</div>
          {invs.length === 0 ? (
            <div className="empty"><i className="ti ti-seeding" />Aucun placement. Ajoutez-en un !</div>
          ) : (
            <table className="plac-table">
              <thead>
                <tr>
                  <th className="plac-th">Actif</th>
                  <th className="plac-th">Type</th>
                  <th className="plac-th plac-th-num">Quantité</th>
                  <th className="plac-th plac-th-num">Prix unitaire</th>
                  <th className="plac-th plac-th-num">Valeur</th>
                  <th className="plac-th plac-th-num">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {invs.map((inv) => {
                  const pos = inv.gainCents >= 0
                  return (
                    <tr
                      key={inv.id}
                      className="plac-row"
                      onClick={() => setModal({ open: true, item: inv })}
                    >
                      <td className="plac-td">
                        <div className="plac-name">{inv.name}</div>
                        {inv.ticker && <div className="plac-ticker">{inv.ticker}</div>}
                      </td>
                      <td className="plac-td">{KIND_LABELS[inv.kind] ?? inv.kind}</td>
                      <td className="plac-td plac-td-num">{inv.quantity}</td>
                      <td className="plac-td plac-td-num">{formatCents(inv.unitPriceCents)}</td>
                      <td className="plac-td plac-td-num">{formatCents(inv.currentValueCents)}</td>
                      <td className={`plac-td plac-td-num ${pos ? "pos" : "neg"}`}>
                        <div>{pos ? "+" : ""}{formatCents(inv.gainCents)}</div>
                        <div className="plac-pct">{fmtPct(inv.gainPct)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal.open && (
        <InvestmentModal
          investment={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
