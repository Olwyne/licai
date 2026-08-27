"use client"
import { useEffect, useRef, useState } from "react"
import type { Account, Category } from "@/db/schema"

export interface Filters {
  q: string
  accountId: string
  categoryId: string
  type: "all" | "income" | "expense"
  period: "all" | "current" | "last" | "3months" | "year" | "custom"
  dateFrom: string
  dateTo: string
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  accountId: "",
  categoryId: "",
  type: "all",
  period: "all",
  dateFrom: "",
  dateTo: "",
}

interface Props {
  filters: Filters
  accounts: Account[]
  categories: Category[]
  onChange: (f: Filters) => void
}

export function FilterPanel({ filters, accounts, categories, onChange }: Props) {
  const [localQ, setLocalQ] = useState(filters.q)

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters })

  // Debounce text search — refs ensure no stale closure
  useEffect(() => {
    const t = setTimeout(() => {
      if (localQ !== filtersRef.current.q) {
        onChangeRef.current({ ...filtersRef.current, q: localQ })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [localQ])

  function set(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch })
  }

  function reset() {
    setLocalQ("")
    onChange(DEFAULT_FILTERS)
  }

  const hasFilter =
    filters.q !== "" ||
    filters.accountId !== "" ||
    filters.categoryId !== "" ||
    filters.type !== "all" ||
    filters.period !== "all"

  return (
    <div className="filter-panel">
      <div className="filter-group">
        <label htmlFor="fp-q">Recherche</label>
        <input
          id="fp-q"
          type="text"
          placeholder="Nom de l'opération…"
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="fp-account">Compte</label>
        <select
          id="fp-account"
          value={filters.accountId}
          onChange={(e) => set({ accountId: e.target.value })}
        >
          <option value="">Tous les comptes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="fp-cat">Catégorie</label>
        <select
          id="fp-cat"
          value={filters.categoryId}
          onChange={(e) => set({ categoryId: e.target.value })}
        >
          <option value="">Toutes</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="fp-period">Période</label>
        <select
          id="fp-period"
          value={filters.period}
          onChange={(e) => set({ period: e.target.value as Filters["period"] })}
        >
          <option value="all">Tout</option>
          <option value="current">Mois actuel</option>
          <option value="last">Dernier mois</option>
          <option value="3months">3 derniers mois</option>
          <option value="year">Cette année</option>
          <option value="custom">Personnalisé</option>
        </select>
      </div>

      {filters.period === "custom" && (
        <>
          <div className="filter-group">
            <label htmlFor="fp-from">Du</label>
            <input
              id="fp-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set({ dateFrom: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="fp-to">Au</label>
            <input
              id="fp-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => set({ dateTo: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="filter-group">
        <label htmlFor="fp-type">Type</label>
        <select
          id="fp-type"
          value={filters.type}
          onChange={(e) => set({ type: e.target.value as Filters["type"] })}
        >
          <option value="all">Tout</option>
          <option value="income">Revenus</option>
          <option value="expense">Dépenses</option>
        </select>
      </div>

      {hasFilter && (
        <button className="filter-reset" type="button" onClick={reset}>
          Réinitialiser
        </button>
      )}
    </div>
  )
}
