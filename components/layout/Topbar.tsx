"use client"
import { useSearch } from "@/contexts/SearchContext"

interface Props { title: string; sub: string; action?: React.ReactNode }

export function Topbar({ title, sub, action }: Props) {
  const { openSearch } = useSearch()
  return (
    <div className="topbar">
      <div>
        <h1 id="screen-title">{title}</h1>
        <div className="sub" id="screen-sub">{sub}</div>
      </div>
      <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button className="btn btn-ghost btn-sm cmd-trigger" onClick={openSearch}>
          <i className="ti ti-search" />
          <span className="cmd-hint">⌘K</span>
        </button>
        {action}
      </div>
    </div>
  )
}
