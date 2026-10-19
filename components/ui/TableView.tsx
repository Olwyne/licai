"use client"
import type { ReactNode } from "react"
import type { TableView } from "@/lib/use-table-view"

/** En-tête de colonne triable (clic ou clavier) : indique le sens du tri et l'annonce aux lecteurs d'écran. */
export function SortTh<T>({ view, col, className, children, title }: { view: TableView<T>; col: string; className?: string; children: ReactNode; title?: string }) {
  const active = view.sort?.key === col
  const dir = active ? view.sort!.dir : null
  return (
    <th className={className} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} title={title}>
      <button type="button" className={`th-sort${active ? " on" : ""}`} onClick={() => view.toggleSort(col)}>
        {children}
        <i aria-hidden="true" className={`ti ${dir === "asc" ? "ti-chevron-up" : dir === "desc" ? "ti-chevron-down" : "ti-selector"}`} />
      </button>
    </th>
  )
}

/** Champ de filtre d'un tableau, avec le nombre de lignes affichées. */
export function TableFilter<T>({ view, placeholder = "Filtrer…", label = "Filtrer le tableau" }: { view: TableView<T>; placeholder?: string; label?: string }) {
  return (
    <div className="tbl-filter">
      <i aria-hidden="true" className="ti ti-search" />
      <input type="search" aria-label={label} placeholder={placeholder} value={view.query} onChange={(e) => view.setQuery(e.target.value)} />
      {view.filtered && <span className="tbl-count" role="status">{view.rows.length} / {view.total}</span>}
    </div>
  )
}
