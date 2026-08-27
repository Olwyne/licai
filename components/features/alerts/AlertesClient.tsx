"use client"
import { useState } from "react"
import { Chip } from "@/components/ui/Chip"
import type { Alert } from "@/db/schema"

type FilterMode = "pending" | "all" | "echeance" | "optim" | "budget"

const FILTERS: { value: FilterMode; label: string }[] = [
  { value: "pending", label: "À traiter" },
  { value: "all", label: "Tout" },
  { value: "echeance", label: "Échéances" },
  { value: "optim", label: "Optimisations" },
  { value: "budget", label: "Budget" },
]

const TONE_CLASS: Record<string, string> = {
  warning: "warn",
  danger: "high",
  info: "info",
  success: "good",
}

const TONE_ICON: Record<string, string> = {
  warning: "ti-alert-triangle",
  danger: "ti-alert-triangle",
  info: "ti-info-circle",
  success: "ti-check",
}

const TONE_COLOR: Record<string, string> = {
  warning: "var(--accent)",
  danger: "var(--danger)",
  info: "var(--info)",
  success: "var(--success)",
}

interface Props {
  initialAlerts: Alert[]
}

export function AlertesClient({ initialAlerts }: Props) {
  const [alertList, setAlertList] = useState<Alert[]>(initialAlerts)
  const [filter, setFilter] = useState<FilterMode>("pending")

  const filtered = alertList.filter((a) => {
    if (filter === "pending") return !a.resolved
    if (filter === "all") return true
    return a.kind === filter
  })

  async function handleResolve(id: string) {
    // Optimistic update
    setAlertList((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
    )
    try {
      await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      })
    } catch {
      // Revert on error
      setAlertList((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: false } : a))
      )
    }
  }

  async function handleReopen(id: string) {
    setAlertList((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: false } : a))
    )
    try {
      await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: false }),
      })
    } catch {
      setAlertList((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
      )
    }
  }

  return (
    <div className="page-alertes">
      <div className="page-header">
        <h1 className="page-title">Alertes</h1>
      </div>

      <div className="al-chips">
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="al-list">
        {filtered.length === 0 && (
          <p className="text-secondary">Aucune alerte.</p>
        )}
        {filtered.map((a) => {
          const toneClass = TONE_CLASS[a.tone] ?? "info"
          const icon = TONE_ICON[a.tone] ?? "ti-info-circle"
          const iconColor = TONE_COLOR[a.tone] ?? "var(--info)"
          const daysUntil = a.date
            ? Math.round((new Date(a.date).getTime() - Date.now()) / 86400000)
            : null
          const dueSoon = daysUntil !== null && daysUntil <= 30

          return (
            <div
              key={a.id}
              className={`al-row ${toneClass} ${a.resolved ? "muted" : ""}`}
            >
              <div className="al-icon-wrap">
                <i
                  className={`ti ${icon}`}
                  style={{ color: iconColor, fontSize: 20 }}
                />
              </div>

              <div className="al-body">
                <div className="al-title">{a.title}</div>
                <div className="al-text">{a.body}</div>
              </div>

              <div className="al-side">
                <span className={`al-due${dueSoon ? " soon" : ""}`}>
                  {a.date ? a.date : "Sans échéance"}
                </span>
                <div className="al-acts">
                  {a.resolved ? (
                    <button
                      className="al-btn"
                      type="button"
                      onClick={() => handleReopen(a.id)}
                    >
                      Réouvrir
                    </button>
                  ) : (
                    <button
                      className="al-btn primary"
                      type="button"
                      onClick={() => handleResolve(a.id)}
                    >
                      Résolu ✓
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
