"use client"
import { useState, useEffect, useCallback } from "react"
import { formatCents } from "@/lib/money"
import { PrevoyanceAnalysis } from "@/components/features/prevoyance/PrevoyanceAnalysis"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractRow {
  id: string
  householdId: string
  name: string
  insurer: string
  kind: string
  valueCents: number
  monthlyPremiumCents: number
  startDate: string | null
  endDate: string | null
  note: string
  createdAt: string
}

interface Kpis {
  totalValueCents: number
  totalMonthlyPremiumCents: number
  count: number
  byKind: Record<string, number>
}

interface PrevoyanceData {
  contracts: ContractRow[]
  kpis: Kpis
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  "assurance-vie": "Assurance-vie",
  prevoyance: "Prévoyance",
  retraite: "Retraite",
  sante: "Santé",
  autre: "Autre",
}

const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))

const KIND_COLORS: Record<string, string> = {
  "assurance-vie": "#1D9E75",
  prevoyance: "#378ADD",
  retraite: "#7C6BD6",
  sante: "#D4537E",
  autre: "#888780",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseEuros(str: string): number {
  const n = parseFloat(str.replace(/\s/g, "").replace(",", "."))
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

// ─── Contract Modal ───────────────────────────────────────────────────────────

interface ContractModalProps {
  contract: ContractRow | null
  onClose: () => void
  onSaved: (c: ContractRow) => void
  onDeleted: (id: string) => void
}

function ContractModal({ contract, onClose, onSaved, onDeleted }: ContractModalProps) {
  const isEdit = contract !== null
  const [name, setName] = useState(contract?.name ?? "")
  const [insurer, setInsurer] = useState(contract?.insurer ?? "")
  const [kind, setKind] = useState(contract?.kind ?? "assurance-vie")
  const [valueStr, setValueStr] = useState(contract ? centsToEuros(contract.valueCents) : "")
  const [premiumStr, setPremiumStr] = useState(contract ? centsToEuros(contract.monthlyPremiumCents) : "")
  const [startDate, setStartDate] = useState(contract?.startDate ?? "")
  const [endDate, setEndDate] = useState(contract?.endDate ?? "")
  const [note, setNote] = useState(contract?.note ?? "")
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
        insurer: insurer.trim(),
        kind,
        valueCents: parseEuros(valueStr),
        monthlyPremiumCents: parseEuros(premiumStr),
        startDate: startDate || null,
        endDate: endDate || null,
        note,
      }
      const res = await fetch(
        isEdit ? `/api/prevoyance/${contract.id}` : "/api/prevoyance",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      )
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      const json = (await res.json()) as { data: ContractRow }
      onSaved(json.data)
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!contract) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/prevoyance/${contract.id}`, { method: "DELETE" })
      if (!res.ok) { setError("Erreur lors de la suppression."); return }
      onDeleted(contract.id)
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le contrat" : "Ajouter un contrat"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}
            <div className="field">
              <label>Nom du contrat</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Assurance-vie Linxea" required />
            </div>
            <div className="field">
              <label>Assureur</label>
              <input value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="Linxea" />
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
              <label>Valeur actuelle (€)</label>
              <input value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="18400.00" />
            </div>
            <div className="field">
              <label>Cotisation mensuelle (€)</label>
              <input value={premiumStr} onChange={(e) => setPremiumStr(e.target.value)} placeholder="300.00" />
            </div>
            <div className="field">
              <label>Date de début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Date de fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fonds euros + UC…" />
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

export function PrevoyanceClient() {
  const [data, setData] = useState<PrevoyanceData | null>(null)
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [modal, setModal] = useState<{ open: boolean; item: ContractRow | null }>({ open: false, item: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/prevoyance")
      if (!res.ok) { setLoadError("Impossible de charger les contrats."); return }
      const json = (await res.json()) as { data: PrevoyanceData }
      setData(json.data)
    } catch {
      setLoadError("Erreur réseau.")
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function onSaved() {
    setModal({ open: false, item: null })
    void load()
    setReloadKey((k) => k + 1)
  }

  function onDeleted(id: string) {
    setModal({ open: false, item: null })
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, contracts: prev.contracts.filter((x) => x.id !== id) }
    })
    void load()
  }

  const { contracts: rows, kpis } = data ?? { contracts: [] as ContractRow[], kpis: { totalValueCents: 0, totalMonthlyPremiumCents: 0, count: 0, byKind: {} } }

  return (
    <div className="page-prevoyance">
      <PrevoyanceAnalysis reloadKey={reloadKey} />

      <div className="page-header" style={{ marginTop: "var(--gap-lg)" }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 17 }}>Contrats de prévoyance</h2>
          <div className="page-sub">Assurance-vie, retraite, santé et prévoyance suivis dans le foyer</div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setModal({ open: true, item: null })}
        >
          <i aria-hidden="true" className="ti ti-plus" /> Ajouter
        </button>
      </div>

      {loadError && <div className="empty"><i aria-hidden="true" className="ti ti-alert-circle" />{loadError}</div>}
      {!data && !loadError && <div className="empty"><i aria-hidden="true" className="ti ti-loader" />Chargement…</div>}

      {/* KPI cards */}
      <div className="metrics metrics-3">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Valeur épargnée</span>
            <div className="metric-ic metric-ic-info">
              <i aria-hidden="true" className="ti ti-piggy-bank" />
            </div>
          </div>
          <div className="metric-value num">{formatCents(kpis.totalValueCents)}</div>
          <div className="metric-sub neutral">
            <i aria-hidden="true" className="ti ti-info-circle" />
            Assurance-vie &amp; retraite
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Cotisations mensuelles</span>
            <div className="metric-ic metric-ic-info">
              <i aria-hidden="true" className="ti ti-calendar-repeat" />
            </div>
          </div>
          <div className="metric-value num">{formatCents(kpis.totalMonthlyPremiumCents)}</div>
          <div className="metric-sub neutral">
            <i aria-hidden="true" className="ti ti-info-circle" />
            Total mensuel
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Nombre de contrats</span>
            <div className="metric-ic metric-ic-info">
              <i aria-hidden="true" className="ti ti-file-description" />
            </div>
          </div>
          <div className="metric-value num">{kpis.count}</div>
          <div className="metric-sub neutral">
            <i aria-hidden="true" className="ti ti-info-circle" />
            Contrats actifs
          </div>
        </div>
      </div>

      {/* Contracts list */}
      {rows.length === 0 ? (
        <div className="empty"><i aria-hidden="true" className="ti ti-shield-off" />Aucun contrat. Ajoutez-en un !</div>
      ) : (
        <div className="prev-list">
          <div className="prev-head">
            <span>Contrat</span>
            <span>Type</span>
            <span>Valeur</span>
            <span>Cotisation / mois</span>
            <span>Début</span>
          </div>
          {rows.map((c) => (
            <div
              key={c.id}
              className="prev-row"
              onClick={() => setModal({ open: true, item: c })}
            >
              <div className="prev-name">
                {c.name}
                {c.insurer && <span className="prev-info">{c.insurer}</span>}
              </div>
              <div>
                <span
                  className="prev-badge"
                  style={{ background: KIND_COLORS[c.kind] ?? "#888780" }}
                >
                  {KIND_LABELS[c.kind] ?? c.kind}
                </span>
              </div>
              <div className="prev-info num">
                {c.valueCents > 0 ? formatCents(c.valueCents) : "—"}
              </div>
              <div className="prev-info num">
                {c.monthlyPremiumCents > 0 ? formatCents(c.monthlyPremiumCents) : "—"}
              </div>
              <div className="prev-dates">
                {c.startDate ?? "—"}
                {c.endDate && <span> → {c.endDate}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <ContractModal
          contract={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
