"use client"
import { fmtCurrency } from "@/lib/finance/fx"
import Link from "next/link"
import { LoanModal } from "@/components/features/credits/LoanModal"
import { PatrimoineInsights } from "./PatrimoineInsights"
import { useState, useEffect, useCallback, useRef } from "react"
import { formatCents } from "@/lib/money"
import type { Property, Loan } from "@/db/schema"

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  name: string
  short: string
  colorHex: string
}

interface OwnerEntry {
  memberId: string
  sharePercent: number
  name?: string
  short?: string
  colorHex?: string
}

interface Lot {
  type: "parking" | "garage" | "cave" | "autre"
  qty: number
  sqm: number
  unit?: "m2" | "m" | "cm2"
}

interface PropertyWithOwners extends Property {
  owners: OwnerEntry[]
}

interface Kpis {
  actifBrut: number
  passif: number
  patrimoineNet: number
  plusValue: number
  mensualitesTotales: number
}

interface PatrimoineData {
  properties: PropertyWithOwners[]
  loans: Loan[]
  accounts: { totalCents: number }
  members: MemberInfo[]
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

const USAGE_LABEL: Record<string, string> = { principale: "Résidence principale", secondaire: "Secondaire", locatif: "Locatif" }

const LOT_KINDS: { value: Lot["type"]; label: string }[] = [
  { value: "parking", label: "Parking" },
  { value: "garage", label: "Garage" },
  { value: "cave", label: "Cave" },
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

function parseLots(raw: string | undefined | null): Lot[] {
  try { return JSON.parse(raw ?? "[]") as Lot[] } catch { return [] }
}

interface TaxeEntry { year: number; amountCents: number }

function parseTaxeHistory(raw: string | undefined | null): TaxeEntry[] {
  try { return JSON.parse(raw ?? "[]") as TaxeEntry[] } catch { return [] }
}

function dateLabel(date: string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

function formatEuros(euros: number): string {
  return fmtCurrency(Math.round(euros))
}

// ─── Address Autocomplete ─────────────────────────────────────────────────────

interface BanFeature {
  properties: { label: string; postcode: string; city: string }
}

interface AddressInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}

function AddressInput({ value, onChange, placeholder }: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<BanFeature[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  function handleInput(val: string) {
    onChange(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.trim().length < 4) { setSuggestions([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=5`)
        const json = (await res.json()) as { features: BanFeature[] }
        setSuggestions(json.features ?? [])
        setOpen(true)
      } catch { setSuggestions([]) }
    }, 300)
  }

  function pick(label: string) {
    onChange(label)
    setSuggestions([])
    setOpen(false)
  }

  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOut)
    return () => document.removeEventListener("mousedown", onClickOut)
  }, [])

  return (
    <div ref={wrapRef} className="address-wrap">
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder ?? "12 rue de la Paix, Lyon 69003"}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="address-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => pick(s.properties.label)} className="address-suggestion">
              <i aria-hidden="true" className="ti ti-map-pin" />
              {s.properties.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Property Modal ───────────────────────────────────────────────────────────

interface PropertyModalProps {
  property: PropertyWithOwners | null
  members: MemberInfo[]
  loans: Loan[]
  onClose: () => void
  onSaved: (p: PropertyWithOwners) => void
  onDeleted: (id: string) => void
}

function PropertyModal({ property, members, loans, onClose, onSaved, onDeleted }: PropertyModalProps) {
  const isEdit = property !== null
  const [name, setName] = useState(property?.name ?? "")
  const [kind, setKind] = useState(property?.kind ?? "immobilier")
  const [valueEuros, setValueEuros] = useState(property ? centsToEuros(property.valueCents) : "")
  const [purchasePriceEuros, setPurchasePriceEuros] = useState(property ? centsToEuros(property.purchasePriceCents) : "")
  const [purchaseDate, setPurchaseDate] = useState(property?.purchaseDate ?? "")
  const [note, setNote] = useState(property?.note ?? "")
  const [residenceType, setResidenceType] = useState(property?.residenceType ?? "principale")
  const [address, setAddress] = useState(property?.address ?? "")
  const [surfaceSqm, setSurfaceSqm] = useState(property?.surfaceSqm ? String(property.surfaceSqm) : "")
  const [lots, setLots] = useState<Lot[]>(parseLots(property?.lots))
  const [taxeHistory, setTaxeHistory] = useState<TaxeEntry[]>(parseTaxeHistory(property?.taxeFonciereHistory))
  const [lastEstimatedAt, setLastEstimatedAt] = useState<string | null>(property?.lastEstimatedAt ?? null)
  const [owners, setOwners] = useState<OwnerEntry[]>(property?.owners ?? [])
  const [linkedLoanIds, setLinkedLoanIds] = useState<Set<string>>(
    new Set(loans.filter(l => l.propertyId === property?.id).map(l => l.id))
  )
  const [rentEuros, setRentEuros] = useState(property && property.rentMonthlyCents ? centsToEuros(property.rentMonthlyCents) : "")
  const initCosts = (() => { try { return JSON.parse(property?.costs ?? "{}") as Record<string, number> } catch { return {} as Record<string, number> } })()
  const [costs, setCosts] = useState<Record<string, string>>(
    Object.fromEntries(["copro", "assur", "gestion", "travaux", "vacance", "notaire"].map((k) => [k, initCosts[k] ? String(initCosts[k]) : ""]))
  )
  const [hasLoan, setHasLoan] = useState(true)
  const [newLoanLeft, setNewLoanLeft] = useState("")
  const [newLoanMonthly, setNewLoanMonthly] = useState("")
  const [estimating, setEstimating] = useState(false)
  const [estimateInfo, setEstimateInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const isImmo = kind === "immobilier"
  const valueNum = parseFloat(valueEuros.replace(/\s/g, "").replace(",", ".")) || 0
  const purchaseNum = parseFloat(purchasePriceEuros.replace(/\s/g, "").replace(",", ".")) || 0
  const surfNum = parseFloat(surfaceSqm) || 0
  const plusValue = valueNum - purchaseNum
  const pricePerSqm = surfNum > 0 ? Math.round((valueNum * 100) / surfNum) : 0
  const canEstimate = isImmo && address.trim().length > 0 && surfNum > 0

  async function handleEstimate() {
    if (!canEstimate) return
    setEstimating(true)
    setEstimateInfo("")
    try {
      const res = await fetch("/api/patrimoine/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), surfaceSqm: surfNum }),
      })
      const json = (await res.json()) as { data?: { estimatedEuros: number; pricePerSqm: number; transactionCount: number; radius: number; period: string }; error?: string }
      if (!res.ok) {
        setEstimateInfo(json.error ?? "Données insuffisantes pour cette adresse.")
        return
      }
      const d = json.data!
      setValueEuros(String(d.estimatedEuros))
      setLastEstimatedAt(new Date().toISOString().split("T")[0])
      setEstimateInfo(`DVF ${d.period} · ${d.pricePerSqm.toLocaleString("fr-FR")} €/m² · ${d.transactionCount} ventes · rayon ${d.radius} m`)
    } finally {
      setEstimating(false)
    }
  }

  function addLot() {
    setLots([...lots, { type: "parking", qty: 1, sqm: 0, unit: "m2" }])
  }

  function updateLot(i: number, patch: Partial<Lot>) {
    setLots(lots.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  function removeLot(i: number) {
    setLots(lots.filter((_, idx) => idx !== i))
  }

  function toggleOwner(memberId: string) {
    const existing = owners.find((o) => o.memberId === memberId)
    if (existing) {
      setOwners(owners.filter((o) => o.memberId !== memberId))
    } else {
      const remaining = 100 - owners.reduce((s, o) => s + o.sharePercent, 0)
      setOwners([...owners, { memberId, sharePercent: Math.max(0, remaining) }])
    }
  }

  function setShare(memberId: string, pct: number) {
    setOwners(owners.map((o) => o.memberId === memberId ? { ...o, sharePercent: pct } : o))
  }

  const totalShare = owners.reduce((s, o) => s + o.sharePercent, 0)

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
        address: isImmo ? address : "",
        surfaceSqm: isImmo && surfNum > 0 ? surfNum : null,
        lots: isImmo ? JSON.stringify(lots) : "[]",
        taxeFonciereCents: isImmo ? (taxeHistory.length > 0 ? [...taxeHistory].sort((a, b) => b.year - a.year)[0].amountCents : 0) : 0,
        taxeFonciereHistory: isImmo ? JSON.stringify(taxeHistory) : "[]",
        lastEstimatedAt,
        residenceType: isImmo ? residenceType : "principale",
        rentMonthlyCents: isImmo && residenceType === "locatif" ? parseEuros(rentEuros) : 0,
        costs: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, parseFloat(v.replace(/\s/g, "").replace(",", ".")) || 0])),
        owners,
      }
      const res = await fetch(
        isEdit ? `/api/patrimoine/properties/${property.id}` : "/api/patrimoine/properties",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      )
      if (!res.ok) { setError("Erreur lors de l'enregistrement."); return }
      const json = (await res.json()) as { data: PropertyWithOwners }
      const savedId = json.data.id
      // Crédit en cours saisi directement dans la modale (nouveau bien uniquement)
      if (!isEdit && isImmo && hasLoan && (parseEuros(newLoanLeft) > 0 || parseEuros(newLoanMonthly) > 0)) {
        await fetch("/api/credits", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Crédit ${name.trim()}`, kind: "immobilier",
            principalCents: parseEuros(newLoanLeft), remainingCents: parseEuros(newLoanLeft),
            monthlyPaymentCents: parseEuros(newLoanMonthly), ratePercent: 0, propertyId: savedId,
          }),
        })
      }
      // Sync loan links: link selected, unlink deselected
      const loansToUpdate = loans.filter(l => {
        const wasLinked = l.propertyId === property?.id
        const isLinked = linkedLoanIds.has(l.id)
        return wasLinked !== isLinked
      })
      await Promise.all(loansToUpdate.map(l =>
        fetch(`/api/patrimoine/loans/${l.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: linkedLoanIds.has(l.id) ? savedId : null }),
        })
      ))
      onSaved(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!property) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/patrimoine/properties/${property.id}`, { method: "DELETE" })
      if (!res.ok) { setError("Erreur lors de la suppression"); return }
      onDeleted(property.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3>{isEdit ? "Modifier le bien" : "Ajouter un bien immobilier"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}

            {/* Section 1 — Identification */}
            <div className="modal-section-title">Bien</div>
            <div className="field">
              <label>Nom du bien</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Appartement Lyon 3e" required />
            </div>
            <div className="field">
              <label>Type</label>
              <div className="select w-full">
                <select className="w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {PROPERTY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            </div>
            {isImmo && (
              <div className="field">
                <label>Usage</label>
                <div className="residence-toggle">
                  {([["principale", "Résidence principale"], ["secondaire", "Résidence secondaire"], ["locatif", "Locatif"]] as [string, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`residence-opt ${residenceType === val ? "residence-opt--active" : ""}`}
                      onClick={() => setResidenceType(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2 — Immobilier fields */}
            {isImmo && (
              <>
                <div className="modal-section-title">Adresse &amp; surface</div>
                <div className="field">
                  <label>Ville / secteur</label>
                  <AddressInput value={address} onChange={setAddress} />
                </div>
                <div className="field">
                  <label>Surface (m²)</label>
                  <input type="number" min="1" step="any" value={surfaceSqm} onChange={(e) => setSurfaceSqm(e.target.value)} placeholder="65" />
                </div>
              </>
            )}

            {/* Section 3 — Valorisation */}
            <div className="modal-section-title">Valorisation</div>
            <div className="field">
              <label>Prix d&apos;achat</label>
              <input value={purchasePriceEuros} onChange={(e) => setPurchasePriceEuros(e.target.value)} placeholder="240 000" />
            </div>
            <div className="field">
              <label>Date d&apos;achat</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Valeur estimée</label>
              <div className="input-row">
                <input value={valueEuros} onChange={(e) => setValueEuros(e.target.value)} placeholder="280 000" />
                {isImmo && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleEstimate}
                    disabled={!canEstimate || estimating}
                    title={canEstimate ? "Estimer via DVF" : "Renseignez l'adresse et la surface"}
                  >
                    {estimating ? <i aria-hidden="true" className="ti ti-loader" /> : <i aria-hidden="true" className="ti ti-sparkles" />}
                    {isEdit ? "Réévaluer" : "Estimer"}
                  </button>
                )}
              </div>
              {estimateInfo && (
                <div className="field-hint" style={{ color: estimateInfo.startsWith("DVF") ? "var(--primary)" : "var(--danger)" }}>
                  {estimateInfo}
                </div>
              )}
              {lastEstimatedAt && (
                <div className="field-hint">Dernière estimation : {dateLabel(lastEstimatedAt)}</div>
              )}
            </div>
            {isImmo && surfNum > 0 && valueNum > 0 && (
              <div className="field-computed-row">
                <div className="field-computed">
                  <span className="field-computed-label">Prix / m²</span>
                  <span className="field-computed-val num">{pricePerSqm.toLocaleString("fr-FR")} €</span>
                </div>
                <div className="field-computed">
                  <span className="field-computed-label">Plus-value latente</span>
                  <span className={`field-computed-val num ${plusValue >= 0 ? "up" : "down"}`}>
                    {plusValue >= 0 ? "+" : "−"}{formatEuros(Math.abs(plusValue))}
                  </span>
                </div>
              </div>
            )}

            {isImmo && residenceType === "locatif" && (
              <div className="field">
                <label>Loyer mensuel perçu</label>
                <div className="field-amount"><input type="text" inputMode="decimal" placeholder="640" value={rentEuros} onChange={(e) => setRentEuros(e.target.value)} /><span className="cur">€</span></div>
              </div>
            )}
            {isImmo && (
              <>
                <div className="modal-section-title">Charges &amp; rentabilité</div>
                <div className="field-row">
                  {([["copro", "Charges de copropriété (€/an)"], ["assur", "Assurance PNO (€/an)"]] as [string, string][]).map(([k, l]) => (
                    <div className="field" key={k}><label>{l}</label><input type="text" inputMode="decimal" value={costs[k]} onChange={(e) => setCosts({ ...costs, [k]: e.target.value })} /></div>
                  ))}
                </div>
                {residenceType === "locatif" && (
                  <div className="field-row">
                    {([["gestion", "Frais de gestion (€/an)"], ["travaux", "Travaux d'entretien (€/an)"]] as [string, string][]).map(([k, l]) => (
                      <div className="field" key={k}><label>{l}</label><input type="text" inputMode="decimal" value={costs[k]} onChange={(e) => setCosts({ ...costs, [k]: e.target.value })} /></div>
                    ))}
                  </div>
                )}
                <div className="field-row">
                  <div className="field"><label>Frais de notaire (€)</label><input type="text" inputMode="decimal" value={costs.notaire} onChange={(e) => setCosts({ ...costs, notaire: e.target.value })} /></div>
                  {residenceType === "locatif" && <div className="field"><label>Vacance locative (%)</label><input type="text" inputMode="decimal" placeholder="5" value={costs.vacance} onChange={(e) => setCosts({ ...costs, vacance: e.target.value })} /></div>}
                </div>
              </>
            )}
            {isImmo && !isEdit && (
              <>
                <div className="field">
                  <label>Crédit en cours</label>
                  <div className="type-toggle">
                    <button type="button" className={`type-opt${hasLoan ? " active" : ""}`} onClick={() => setHasLoan(true)}>Oui</button>
                    <button type="button" className={`type-opt${!hasLoan ? " active" : ""}`} onClick={() => setHasLoan(false)}>Aucun crédit</button>
                  </div>
                </div>
                {hasLoan && (
                  <div className="field-row">
                    <div className="field"><label>Capital restant dû</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="186 400" value={newLoanLeft} onChange={(e) => setNewLoanLeft(e.target.value)} /><span className="cur">€</span></div></div>
                    <div className="field"><label>Mensualité</label><div className="field-amount"><input type="text" inputMode="decimal" placeholder="980" value={newLoanMonthly} onChange={(e) => setNewLoanMonthly(e.target.value)} /><span className="cur">€</span></div></div>
                  </div>
                )}
              </>
            )}

            {/* Section 4 — Lots annexes */}
            {isImmo && (
              <>
                <div className="modal-section-title">
                  Lots annexes
                  <button type="button" className="btn btn-ghost btn-xs" onClick={addLot}>
                    <i aria-hidden="true" className="ti ti-plus" /> Ajouter
                  </button>
                </div>
                {lots.length === 0 && (
                  <div className="field-hint">Aucun lot. Ex : parking, garage, cave vendus avec le bien.</div>
                )}
                {lots.map((lot, i) => (
                  <div key={i} className="lot-row">
                    <div className="select lot-type">
                      <select value={lot.type} onChange={(e) => updateLot(i, { type: e.target.value as Lot["type"] })}>
                        {LOT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </div>
                    <div className="lot-sqm-wrap">
                      <input type="number" min="0" step="any" value={lot.sqm || ""} onChange={(e) => updateLot(i, { sqm: parseFloat(e.target.value) || 0 })} placeholder="0" className="lot-sqm" />
                      <div className="select lot-unit">
                        <select value={lot.unit ?? "m2"} onChange={(e) => updateLot(i, { unit: e.target.value as Lot["unit"] })}>
                          <option value="m2">m²</option>
                          <option value="m">m</option>
                          <option value="cm2">cm²</option>
                        </select>
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-xs lot-del" onClick={() => removeLot(i)}>
                      <i aria-hidden="true" className="ti ti-x" />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Section 5 — Charges */}
            {isImmo && (
              <>
                <div className="modal-section-title">
                  Charges
                </div>
                <div className="modal-section-subtitle">
                  Taxe foncière
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => {
                    const nextYear = taxeHistory.length > 0 ? Math.max(...taxeHistory.map(e => e.year)) + 1 : new Date().getFullYear()
                    setTaxeHistory([...taxeHistory, { year: nextYear, amountCents: 0 }])
                  }}>
                    <i aria-hidden="true" className="ti ti-plus" /> Ajouter une année
                  </button>
                </div>
                {taxeHistory.length === 0 && (
                  <div className="field-hint">Aucune taxe enregistrée.</div>
                )}
                {[...taxeHistory].sort((a, b) => b.year - a.year).map((entry) => {
                  const realIdx = taxeHistory.findIndex(e => e.year === entry.year)
                  return (
                    <div key={entry.year} className="taxe-row">
                      <input
                        type="number" min="2000" max="2100" step="1"
                        value={entry.year}
                        onChange={(e) => {
                          const updated = [...taxeHistory]
                          updated[realIdx] = { ...entry, year: parseInt(e.target.value) || entry.year }
                          setTaxeHistory(updated)
                        }}
                        className="taxe-year"
                      />
                      <input
                        type="number" min="0" step="1"
                        value={entry.amountCents > 0 ? (entry.amountCents / 100).toFixed(0) : ""}
                        onChange={(e) => {
                          const updated = [...taxeHistory]
                          updated[realIdx] = { ...entry, amountCents: Math.round((parseFloat(e.target.value) || 0) * 100) }
                          setTaxeHistory(updated)
                        }}
                        placeholder="1 200"
                        className="taxe-amount"
                      />
                      <span className="taxe-unit">€</span>
                      <button type="button" className="btn btn-ghost btn-xs taxe-del" onClick={() => setTaxeHistory(taxeHistory.filter((_, idx) => idx !== realIdx))}>
                        <i aria-hidden="true" className="ti ti-x" />
                      </button>
                    </div>
                  )
                })}
              </>
            )}

            {/* Section 6 — Propriétaires */}
            {members.length > 0 && (
              <>
                <div className="modal-section-title">Quotes-parts</div>
                <div className="owners-list">
                  {members.map((m) => {
                    const entry = owners.find((o) => o.memberId === m.id)
                    const checked = !!entry
                    return (
                      <div key={m.id} className={`owner-row ${checked ? "owner-row--active" : ""}`}>
                        <label className="owner-check">
                          <input type="checkbox" checked={checked} onChange={() => toggleOwner(m.id)} />
                          <span className="owner-avatar" style={{ background: m.colorHex }}>{m.short.substring(0, 2).toUpperCase()}</span>
                          <span className="owner-name">{m.name}</span>
                        </label>
                        {checked && (
                          <div className="owner-share">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={entry!.sharePercent}
                              onChange={(e) => setShare(m.id, parseFloat(e.target.value) || 0)}
                              className="owner-pct"
                            />
                            <span className="owner-pct-sym">%</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {owners.length > 0 && totalShare !== 100 && (
                  <div className="field-hint" style={{ color: "var(--danger)" }}>
                    Total : {totalShare}% — doit être égal à 100%
                  </div>
                )}
              </>
            )}

            {/* Section 7 — Crédit lié */}
            {loans.length > 0 && (
              <>
                <div className="modal-section-title">Crédit lié</div>
                <div className="owners-list">
                  {loans.map(l => {
                    const linked = linkedLoanIds.has(l.id)
                    return (
                      <div key={l.id} className={`owner-row ${linked ? "owner-row--active" : ""}`}>
                        <label className="owner-check">
                          <input
                            type="checkbox"
                            checked={linked}
                            onChange={() => {
                              const next = new Set(linkedLoanIds)
                              if (linked) next.delete(l.id)
                              else next.add(l.id)
                              setLinkedLoanIds(next)
                            }}
                          />
                          <span className="owner-name">{l.name}</span>
                          <span className="pat-date" style={{ marginLeft: "auto" }}>
                            {fmtCurrency(Math.round(l.remainingCents / 100))}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Section 8 — Note */}
            <div className="modal-section-title">Note</div>
            <div className="field">
              <label>Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Résidence principale…" />
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
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading || (owners.length > 0 && totalShare !== 100)}>
                {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter le bien"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Estimation Modal ─────────────────────────────────────────────────────────

const ESTIM_SOURCES = ["Agence", "Notaire", "Estimation perso", "Outil en ligne"]

function EstimModal({ property, onClose, onDone }: { property: PropertyWithOwners; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState(centsToEuros(property.valueCents))
  const [month, setMonth] = useState((property.lastEstimatedAt ?? new Date().toISOString()).slice(0, 7))
  const [source, setSource] = useState(property.estimateSource || ESTIM_SOURCES[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const newCents = parseEuros(value)
  const delta = newCents - property.valueCents
  const sincePurchase = newCents - property.purchasePriceCents

  async function save() {
    if (newCents <= 0) { setError("Indiquez une estimation."); return }
    setBusy(true)
    const res = await fetch(`/api/patrimoine/properties/${property.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueCents: newCents, lastEstimatedAt: `${month}-01`, estimateSource: source }),
    })
    setBusy(false)
    if (!res.ok) { setError("Erreur lors de la mise à jour."); return }
    onDone()
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>Mettre à jour l&apos;estimation</h3>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {error && <div className="obj-modal-err"><i aria-hidden="true" className="ti ti-alert-circle" /> {error}</div>}
          <div className="estim-ctx">
            <div className="estim-ctx-name">{property.name}</div>
            <div className="estim-ctx-sub">{[property.address, property.surfaceSqm ? `${property.surfaceSqm} m²` : ""].filter(Boolean).join(" · ")} · achat {formatCents(property.purchasePriceCents)}</div>
          </div>
          <div className="field"><label>Estimation actuelle</label>
            <div className="field-amount"><input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus /><span className="cur">€</span></div></div>
          <div className="field-row">
            <div className="field"><label>Date de l&apos;estimation</label><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
            <div className="field"><label>Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)}>{ESTIM_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="field-hint">
            {delta === 0 ? "Valeur inchangée" : `${delta > 0 ? "+" : "−"}${formatCents(Math.abs(delta))} vs l'estimation précédente`} · plus-value latente {sincePurchase >= 0 ? "+" : "−"}{formatCents(Math.abs(sincePurchase))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><i aria-hidden="true" className="ti ti-check" /> Mettre à jour</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PatrimoineClient() {
  const [data, setData] = useState<PatrimoineData | null>(null)
  const [loadError, setLoadError] = useState("")

  const [propertyModal, setPropertyModal] = useState<{ open: boolean; item: PropertyWithOwners | null }>({ open: false, item: null })
  const [patFilter, setPatFilter] = useState<string>("all")
  const [insightsKey, setInsightsKey] = useState(0)
  const [estimModal, setEstimModal] = useState<PropertyWithOwners | null>(null)
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
  useEffect(() => { if (data) setInsightsKey((k) => k + 1) }, [data])

  function onPropertySaved(p: PropertyWithOwners) {
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


  if (loadError) {
    return (
      <div className="page-patrimoine">
        <div className="page-header"><h1 className="page-title">Patrimoine immobilier</h1></div>
        <div className="empty"><i aria-hidden="true" className="ti ti-alert-circle" />{loadError}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-patrimoine">
        <div className="page-header"><h1 className="page-title">Patrimoine immobilier</h1></div>
        <div className="empty"><i aria-hidden="true" className="ti ti-loader" />Chargement…</div>
      </div>
    )
  }

  const { properties: props, loans, kpis } = data
  const valeurEstimee = kpis.actifBrut - data.accounts.totalCents
  const immobilierNet = valeurEstimee - kpis.passif
  const plusValuePositive = kpis.plusValue >= 0
  const usageOf = (p: PropertyWithOwners) => (p.residenceType === "locatif" ? "locatif" : p.residenceType === "secondaire" ? "secondaire" : "principale")
  const allImmo = props.filter((p) => p.kind === "immobilier")
  const usageTypes = (["principale", "locatif", "secondaire"] as const).filter((t) => allImmo.some((p) => usageOf(p) === t))
  const immoList = allImmo.filter((p) => patFilter === "all" || usageOf(p) === patFilter)
  const otherList = patFilter === "all" ? props.filter((p) => p.kind !== "immobilier") : []

  return (
    <div className="page-patrimoine">
      <div className="page-header">
        <div>
          <h1 className="page-title">Patrimoine immobilier</h1>
          <div className="page-sub">Estimations actuelles, valeur nette et quotes-parts</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setPropertyModal({ open: true, item: null })}>
          <i aria-hidden="true" className="ti ti-plus" /> Ajouter un bien
        </button>
      </div>

      {/* KPI cards */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Immobilier net</span>
            <div className="metric-ic" style={{ background: "#1D9E7520" }}>
              <i aria-hidden="true" className="ti ti-building-estate" style={{ color: "#1D9E75" }} />
            </div>
          </div>
          <div className="metric-value num">{formatCents(immobilierNet)}</div>
          <div className="metric-sub neutral">Estimations actuelles − capital dû</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Valeur estimée</span>
            <div className="metric-ic" style={{ background: "#378ADD20" }}>
              <i aria-hidden="true" className="ti ti-home" style={{ color: "#378ADD" }} />
            </div>
          </div>
          <div className="metric-value num">{formatCents(valeurEstimee)}</div>
          <div className="metric-sub neutral">{props.length} bien{props.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Capital restant dû</span>
            <div className="metric-ic" style={{ background: "#D85A3020" }}>
              <i aria-hidden="true" className="ti ti-credit-card" style={{ color: "#D85A30" }} />
            </div>
          </div>
          <div className="metric-value num">{formatCents(kpis.passif)}</div>
          <div className="metric-sub neutral">{formatCents(kpis.mensualitesTotales)} / mois</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span className="metric-label">Plus-value latente</span>
            <div className="metric-ic" style={{ background: plusValuePositive ? "#1D9E7520" : "#D85A3020" }}>
              <i aria-hidden="true" className="ti ti-chart-line" style={{ color: plusValuePositive ? "#1D9E75" : "#D85A30" }} />
            </div>
          </div>
          <div className="metric-value num" style={{ color: plusValuePositive ? "var(--primary)" : "var(--danger)" }}>
            {plusValuePositive ? "+" : ""}{formatCents(kpis.plusValue)}
          </div>
          <div className={`metric-sub ${plusValuePositive ? "up" : "down"}`}>
            <i aria-hidden="true" className={`ti ${plusValuePositive ? "ti-trending-up" : "ti-trending-down"}`} />
            vs prix d&apos;achat
          </div>
        </div>
      </div>

      <PatrimoineInsights reloadKey={insightsKey} />

      {/* Biens : filtres + cartes */}
      <div className="toolbar">
        <div className="chips" style={{ margin: 0 }}>
          <button className={`chip${patFilter === "all" ? " active" : ""}`} onClick={() => setPatFilter("all")}>Tous les biens</button>
          {usageTypes.map((t) => (
            <button key={t} className={`chip${patFilter === t ? " active" : ""}`} onClick={() => setPatFilter(t)}>{USAGE_LABEL[t] ?? t}</button>
          ))}
        </div>
      </div>
      {immoList.length === 0 && otherList.length === 0 && (
        <div className="empty"><i aria-hidden="true" className="ti ti-building" />Aucun bien enregistré</div>
      )}
      {immoList.length > 0 && (
        <div className="prop-grid">
          {immoList.map((p) => {
            const cr = loans.filter((l) => l.propertyId === p.id)
            const left = cr.reduce((sum, l) => sum + l.remainingCents, 0)
            const mens = cr.reduce((sum, l) => sum + l.monthlyPaymentCents, 0)
            const borrowed = cr.reduce((sum, l) => sum + l.principalCents, 0)
            const repaid = borrowed ? Math.round(((borrowed - left) / borrowed) * 100) : 100
            const ltv = p.valueCents ? Math.round((left / p.valueCents) * 100) : 0
            const pv = p.valueCents - p.purchasePriceCents
            const yieldPct = p.rentMonthlyCents && p.valueCents ? ((p.rentMonthlyCents * 12) / p.valueCents) * 100 : 0
            const cash = p.rentMonthlyCents - mens
            const bought = p.purchaseDate ? p.purchaseDate.slice(0, 4) : ""
            const usage = p.residenceType === "locatif" ? "locatif" : p.residenceType === "secondaire" ? "secondaire" : "principale"
            return (
              <div className="prop-card" key={p.id} style={{ cursor: "pointer" }} onClick={() => setPropertyModal({ open: true, item: p })}>
                <div className="prop-head">
                  <span className="prop-ic"><i aria-hidden="true" className={`ti ${usage === "locatif" ? "ti-home-dollar" : usage === "secondaire" ? "ti-home-2" : "ti-building-community"}`} /></span>
                  <div className="prop-title">
                    <div className="prop-name">{p.name}</div>
                    <div className="prop-city">{[p.address, p.surfaceSqm ? `${p.surfaceSqm} m²` : ""].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <span className={`prop-badge ${usage === "locatif" ? "rent" : ""}`}>{USAGE_LABEL[usage]}</span>
                </div>
                <div className="estim-row">
                  <div>
                    <div className="pv-lbl">Estimation actuelle</div>
                    <div className="estim-val num private">{formatCents(p.valueCents)}</div>
                    <div className="estim-meta">{p.lastEstimatedAt ? new Date(p.lastEstimatedAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—"} · {p.estimateSource || "—"}</div>
                  </div>
                  <div className={`estim-delta ${pv >= 0 ? "pos" : "neg"}`}>
                    <div className="num private">{pv >= 0 ? "+" : "−"}{formatCents(Math.abs(pv))}</div>
                    <div className="estim-delta-sub">vs achat {bought} (<span className="num private">{formatCents(p.purchasePriceCents)}</span>)</div>
                  </div>
                  <button type="button" className="estim-btn" onClick={(e) => { e.stopPropagation(); setEstimModal(p) }}><i aria-hidden="true" className="ti ti-refresh" /> Réestimer</button>
                </div>
                <div className="prop-vals">
                  <div><div className="pv-lbl">Valeur nette</div><div className="pv-num num private">{formatCents(p.valueCents - left)}</div></div>
                  <div><div className="pv-lbl">Capital dû</div><div className="pv-num num private">{formatCents(left)}</div></div>
                  <div><div className="pv-lbl">Mensualités</div><div className="pv-num num private">{formatCents(mens)}</div></div>
                </div>
                {cr.length ? (
                  <div className="prop-loan">
                    <div className="prop-loan-top">
                      <span>{cr.length} crédit{cr.length > 1 ? "s" : ""} lié{cr.length > 1 ? "s" : ""} · {cr.map((l) => kindLabel(l.kind, LOAN_KINDS)).join(", ")}</span>
                      <span className="num private">{formatCents(left)} restants</span>
                    </div>
                    <div className="bar-bg"><div className="bar-fill" style={{ width: `${Math.min(repaid, 100)}%`, background: "var(--primary)" }} /></div>
                    <div className="prop-loan-foot"><span>{repaid} % remboursé · LTV {ltv} %</span><Link className="card-link" href="/credits" onClick={(e) => e.stopPropagation()}>Détail</Link></div>
                  </div>
                ) : (
                  <div className="prop-loan paid"><i aria-hidden="true" className="ti ti-circle-check" /> Bien détenu sans crédit</div>
                )}
                {p.rentMonthlyCents > 0 && (
                  <div className="prop-rent">
                    <div><span className="pv-lbl">Loyer</span> <span className="num private">{formatCents(p.rentMonthlyCents)}</span></div>
                    <div><span className="pv-lbl">Rendement brut</span> <span className="num">{yieldPct.toFixed(2).replace(".", ",")} %</span></div>
                    <div><span className="pv-lbl">Cash-flow</span> <span className={`num private ${cash >= 0 ? "pos" : "neg"}`}>{cash >= 0 ? "+" : "−"}{formatCents(Math.abs(cash))}</span></div>
                  </div>
                )}
                <div className="prop-shares">
                  {p.owners.map((o) => (
                    <span key={o.memberId} className="share-tag" style={{ borderColor: `${o.colorHex}55`, color: o.colorHex }}>
                      <span className="mini-av" style={{ width: 20, height: 20, fontSize: 8, background: `${o.colorHex}22`, borderColor: `${o.colorHex}55`, color: o.colorHex }}>{(o.short ?? "").slice(0, 2).toUpperCase()}</span>{o.sharePercent} %
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {otherList.length > 0 && (
        <div className="card mb-16" style={{ marginTop: 16 }}>
          <div className="card-header"><span className="card-title">Autres biens</span></div>
          <div className="pat-list">
            {otherList.map((p) => {
              const delta = p.valueCents - p.purchasePriceCents
              return (
                <div key={p.id} className="pat-row" onClick={() => setPropertyModal({ open: true, item: p })}>
                  <div className="pat-info">
                    <div className="pat-info-top"><span className="pat-badge">{kindLabel(p.kind, PROPERTY_KINDS)}</span><span className="pat-name">{p.name}</span>{p.purchaseDate && <span className="pat-date">{dateLabel(p.purchaseDate)}</span>}</div>
                  </div>
                  <div className="pat-amounts">
                    <span className="pat-val num">{formatCents(p.valueCents)}</span>
                    <span className={`pat-delta num ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "+" : "−"}{formatCents(Math.abs(delta))}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Loans section */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Crédits</span>
          <button className="btn btn-primary btn-sm" onClick={() => setLoanModal({ open: true, item: null })}>
            <i aria-hidden="true" className="ti ti-plus" /> Ajouter
          </button>
        </div>
        <div>
          {loans.length === 0 ? (
            <div className="empty"><i aria-hidden="true" className="ti ti-credit-card" />Aucun crédit enregistré</div>
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
          members={data.members}
          loans={data.loans}
          onClose={() => setPropertyModal({ open: false, item: null })}
          onSaved={onPropertySaved}
          onDeleted={onPropertyDeleted}
        />
      )}

      {estimModal && (
        <EstimModal property={estimModal} onClose={() => setEstimModal(null)} onDone={() => { setEstimModal(null); void load() }} />
      )}

      {loanModal.open && (
        <LoanModal
          loan={loanModal.item}
          onClose={() => setLoanModal({ open: false, item: null })}
          onDone={() => { setLoanModal({ open: false, item: null }); void load() }}
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
