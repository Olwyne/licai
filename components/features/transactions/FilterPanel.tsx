"use client"
import { useEffect, useRef, useState } from "react"
import type { Account, Category, Member } from "@/db/schema"

export interface Filters {
  q: string
  sort: "date" | "date-asc" | "amount" | "amount-asc"
  cat: string // "all" | "income" | id de catégorie
  accountId: string
  memberId: string
  type: "" | "expense" | "income"
  shared: "" | "yes" | "no"
  period: "" | "current" | "last" | "30" | "3months" | "year"
  min: string
  max: string
}

export const DEFAULT_FILTERS: Filters = {
  q: "", sort: "date", cat: "all", accountId: "", memberId: "", type: "", shared: "", period: "", min: "", max: "",
}

interface Props {
  filters: Filters
  accounts: Account[]
  categories: Category[]
  members: Member[]
  count: number
  total: number
  onChange: (f: Filters) => void
}

export function FilterPanel({ filters, accounts, categories, members, count, total, onChange }: Props) {
  const [localQ, setLocalQ] = useState(filters.q)
  const onChangeRef = useRef(onChange)
  const filtersRef = useRef(filters)
  useEffect(() => { onChangeRef.current = onChange; filtersRef.current = filters })

  useEffect(() => {
    const t = setTimeout(() => {
      if (localQ !== filtersRef.current.q) onChangeRef.current({ ...filtersRef.current, q: localQ })
    }, 250)
    return () => clearTimeout(t)
  }, [localQ])

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const active = JSON.stringify({ ...filters, sort: "date" }) !== JSON.stringify({ ...DEFAULT_FILTERS })

  return (
    <>
      <div className="toolbar">
        <div className="search"><i className="ti ti-search" />
          <input type="text" placeholder="Rechercher une transaction…" value={localQ} onChange={(e) => setLocalQ(e.target.value)} /></div>
        <div className="select">
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}>
            <option value="date">Plus récentes</option>
            <option value="date-asc">Plus anciennes</option>
            <option value="amount">Montant ↓</option>
            <option value="amount-asc">Montant ↑</option>
          </select>
        </div>
      </div>

      <div className="chips">
        <button className={`chip${filters.cat === "all" ? " active" : ""}`} onClick={() => set({ cat: "all" })}>Toutes</button>
        <button className={`chip${filters.cat === "income" ? " active" : ""}`} onClick={() => set({ cat: "income" })}>Revenus</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip${filters.cat === c.id ? " active" : ""}`} onClick={() => set({ cat: c.id })}>{c.label}</button>
        ))}
      </div>

      <div className="filters">
        <div className="select">
          <select value={filters.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">Tous les comptes</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="select">
          <select value={filters.memberId} onChange={(e) => set({ memberId: e.target.value })}>
            <option value="">Toutes les personnes</option>
            {members.filter((m) => !m.isChild).map((m) => <option key={m.id} value={m.id}>{m.short || m.name}</option>)}
          </select>
        </div>
        <div className="select">
          <select value={filters.type} onChange={(e) => set({ type: e.target.value as Filters["type"] })}>
            <option value="">Revenus &amp; dépenses</option>
            <option value="expense">Dépenses seules</option>
            <option value="income">Revenus seuls</option>
          </select>
        </div>
        <div className="select">
          <select value={filters.shared} onChange={(e) => set({ shared: e.target.value as Filters["shared"] })}>
            <option value="">Communes &amp; perso</option>
            <option value="yes">Communes seulement</option>
            <option value="no">Perso seulement</option>
          </select>
        </div>
        <div className="select">
          <select value={filters.period} onChange={(e) => set({ period: e.target.value as Filters["period"] })}>
            <option value="">Toute la période</option>
            <option value="current">Ce mois</option>
            <option value="last">Mois dernier</option>
            <option value="30">30 derniers jours</option>
            <option value="3months">3 derniers mois</option>
            <option value="year">Cette année</option>
          </select>
        </div>
        <div className="range">
          <input type="text" inputMode="decimal" placeholder="Min €" value={filters.min} onChange={(e) => set({ min: e.target.value })} />
          <span>→</span>
          <input type="text" inputMode="decimal" placeholder="Max €" value={filters.max} onChange={(e) => set({ max: e.target.value })} />
        </div>
        <button className="btn btn-ghost" onClick={() => { setLocalQ(""); onChange(DEFAULT_FILTERS) }} disabled={!active}><i className="ti ti-filter-off" /> Réinitialiser</button>
        <span className="filters-count">{count === total ? `${total} opération${total > 1 ? "s" : ""}` : `${count} sur ${total}`}</span>
      </div>
    </>
  )
}
