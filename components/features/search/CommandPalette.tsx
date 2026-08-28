"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { SearchResult } from "@/app/api/search/route"

interface Props {
  open: boolean
  onClose: () => void
}

const KIND_LABELS: Record<SearchResult["kind"], string> = {
  transaction: "Transactions",
  account: "Comptes",
  member: "Membres",
  category: "Catégories",
}

const KIND_ICONS: Record<SearchResult["kind"], string> = {
  transaction: "ti-transfer",
  account: "ti-building-bank",
  member: "ti-user",
  category: "ti-tag",
}

const KIND_ORDER: SearchResult["kind"][] = ["transaction", "account", "member", "category"]

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setLoading(false)
      setError(false)
      setSelected(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Debounced fetch
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error("search failed")
        const json = await res.json() as { data?: { results: SearchResult[] }; error?: string }
        if (json.data) {
          setResults(json.data.results)
          setSelected(0)
          setError(false)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    doSearch(v)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = results[selected]
        if (item) {
          router.push(item.href)
          onClose()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, results, selected, router, onClose])

  if (!open) return null

  // Group results by kind in order
  const grouped = KIND_ORDER
    .map(kind => ({ kind, items: results.filter(r => r.kind === kind) }))
    .filter(g => g.items.length > 0)

  // Flat index tracking for selected
  let flatIdx = 0

  const hasQuery = query.trim().length >= 2
  const isEmpty = hasQuery && !loading && !error && results.length === 0

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <i className="ti ti-search cmd-icon" />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Rechercher…"
            value={query}
            onChange={handleChange}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <i className="ti ti-loader-2 spin cmd-icon" />}
          <kbd className="cmd-hint">Esc</kbd>
        </div>
        <div className="cmd-results">
          {error && (
            <div className="cmd-empty">Erreur de recherche</div>
          )}
          {isEmpty && (
            <div className="cmd-empty">Aucun résultat pour «&nbsp;{query}&nbsp;»</div>
          )}
          {grouped.map(({ kind, items }) => (
            <div className="cmd-section" key={kind}>
              <div className="cmd-section-title">{KIND_LABELS[kind]}</div>
              {items.map(item => {
                const idx = flatIdx++
                const isActive = idx === selected
                return (
                  <div
                    key={item.id}
                    className={`cmd-item${isActive ? " active" : ""}`}
                    onClick={() => { router.push(item.href); onClose() }}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <div className="cmd-item-icon">
                      <i className={`ti ${KIND_ICONS[item.kind]}`} />
                    </div>
                    <div className="cmd-item-content">
                      <div className="cmd-item-label">{item.label}</div>
                      {item.sub && <div className="cmd-item-sub">{item.sub}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
