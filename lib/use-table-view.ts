"use client"
import { useCallback, useMemo, useState } from "react"
import { filterRows, nextSort, sortRows, type Cell, type SortState } from "@/lib/table-view"

export interface TableView<T> {
  /** Lignes à afficher (filtrées puis triées). */
  rows: T[]
  total: number
  sort: SortState | null
  query: string
  setQuery: (q: string) => void
  toggleSort: (key: string) => void
  filtered: boolean
}

/**
 * Tri (clic sur un en-tête) et filtre texte d'un tableau. `columns` donne, pour chaque colonne, la valeur utilisée pour trier
 * et pour rechercher. `initial` : tri de départ ; `searchKeys` : colonnes concernées par le filtre (toutes par défaut).
 */
export function useTableView<T>(rows: T[], columns: Record<string, (r: T) => Cell>, opts: { initial?: SortState | null; searchKeys?: string[] } = {}): TableView<T> {
  const [sort, setSort] = useState<SortState | null>(opts.initial ?? null)
  const [query, setQuery] = useState("")
  // les accesseurs sont recréés à chaque rendu par l'appelant : seules les lignes, le tri et la recherche déclenchent un recalcul
  /* eslint-disable react-hooks/exhaustive-deps */
  const shown = useMemo(() => sortRows(filterRows(rows, columns, query, opts.searchKeys), columns, sort), [rows, sort, query])
  /* eslint-enable react-hooks/exhaustive-deps */
  const toggleSort = useCallback((key: string) => setSort((s) => nextSort(s, key)), [])
  return { rows: shown, total: rows.length, sort, query, setQuery, toggleSort, filtered: query.trim() !== "" }
}
