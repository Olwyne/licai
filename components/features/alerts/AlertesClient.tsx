"use client"
import { useState } from "react"
import Link from "next/link"
import type { AlertItem, AlertStatus, AlertsPageData } from "@/lib/server/alerts-data"
import { daysBetween } from "@/lib/finance/alerts-engine"
import { eur } from "@/lib/finance/format"
import { monthLabel } from "@/lib/finance/amort"
import { Kpi, PageHeader } from "@/components/features/finance/ui"

type FilterMode = "open" | "echeance" | "optim" | "budget" | "anomalie" | "all" | "done"

const FILTERS: { value: FilterMode; label: string }[] = [
  { value: "open", label: "À traiter" },
  { value: "echeance", label: "Échéances" },
  { value: "optim", label: "Optimisations" },
  { value: "budget", label: "Budget" },
  { value: "anomalie", label: "Anomalies" },
  { value: "all", label: "Tout" },
  { value: "done", label: "Traitées & reportées" },
]

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

export function AlertesClient({ data }: { data: AlertsPageData }) {
  const [items, setItems] = useState<AlertItem[]>(data.items)
  const [filter, setFilter] = useState<FilterMode>("open")
  const days = (iso: string) => daysBetween(data.today, iso)

  function dateLabel(iso: string | null): string {
    if (!iso) return "Sans échéance"
    const [y, m, d] = iso.split("-").map(Number)
    const n = days(iso)
    return `${d} ${MONTHS[m - 1]} ${y}` + (n <= 0 ? " · échu" : n < 45 ? ` · dans ${n} j` : "")
  }

  async function setStatus(a: AlertItem, status: AlertStatus) {
    const prev = items
    setItems((l) => l.map((x) => (x.id === a.id ? { ...x, status } : x)))
    try {
      const res = a.source === "stored"
        ? await fetch(`/api/alerts/${a.id.slice(3)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved: status !== "open" }) })
        : await fetch("/api/alerts/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, status: status === "open" ? null : status }) })
      if (!res.ok) setItems(prev)
    } catch {
      setItems(prev)
    }
  }

  const open = items.filter((a) => a.status === "open")
  const urgent = open.filter((a) => a.tone === "high")
  const soon = open.filter((a) => a.due && days(a.due) <= 60 && days(a.due) >= -30)
  const list = items.filter((a) => (filter === "all" ? true : filter === "open" ? a.status === "open" : filter === "done" ? a.status !== "open" : a.kind === filter && a.status === "open"))

  return (
    <div className="page-alertes">
      <PageHeader title="Alertes & échéances" sub="Ce qui demande une décision, et quand" />

      <div className="metrics">
        <Kpi label="À traiter" icon="ti-bell" color="#EF9F27" value={String(open.length)}
          sub={`${items.filter((a) => a.status === "done").length} traitées · ${items.filter((a) => a.status === "snooze").length} reportées`} />
        <Kpi label="Prioritaires" icon="ti-alert-triangle" color="#D85A30" value={String(urgent.length)}
          sub={urgent.length ? urgent[0].title.slice(0, 44) : "Rien d'urgent"} tone={urgent.length ? "down" : "up"} />
        <Kpi label="Échéances à 60 jours" icon="ti-calendar-due" color="#378ADD" value={String(soon.length)}
          sub={soon.length ? `Prochaine : ${dateLabel(soon[0].due)}` : "Aucune"} />
        <Kpi label="Gain fiscal mobilisable" icon="ti-target-arrow" color="#1D9E75" value={eur((data.perRoom * data.tmi) / 100)}
          sub="Versement PER avant le 31 décembre" />
      </div>

      <div className="chips" id="al-chips">
        {FILTERS.map((f) => <button key={f.value} className={`chip${filter === f.value ? " active" : ""}`} onClick={() => setFilter(f.value)}>{f.label}</button>)}
      </div>

      <div className="card mb-16" style={{ padding: 14 }}>
        <div>
          {list.length === 0 && <div className="empty"><i aria-hidden="true" className="ti ti-check" /> Rien à signaler avec ce filtre.</div>}
          {list.map((a) => (
            <div key={a.id} className={`al-row ${a.tone} ${a.status !== "open" ? "muted" : ""}`}>
              <i aria-hidden="true" className={`ti ${a.icon}`} />
              <div className="al-body">
                <div className="al-title">{a.title}</div>
                <div className="al-text">{a.text}</div>
                {a.action ? <div className="adv-action"><i aria-hidden="true" className="ti ti-arrow-narrow-right" /><span>{a.action}</span></div> : null}
              </div>
              <div className="al-side">
                <span className={`al-due ${a.due && days(a.due) < 30 ? "soon" : ""}`}>{dateLabel(a.due)}</span>
                <div className="al-acts">
                  {a.href && <Link className="al-btn" href={a.href}>Ouvrir</Link>}
                  {a.status === "open" ? (
                    <>
                      <button className="al-btn" type="button" onClick={() => void setStatus(a, "snooze")}>Reporter</button>
                      <button className="al-btn primary" type="button" onClick={() => void setStatus(a, "done")}>Fait</button>
                    </>
                  ) : (
                    <button className="al-btn" type="button" onClick={() => void setStatus(a, "open")}>Rouvrir</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Calendrier des 12 prochains mois</span>
          <span className="card-sub">Échéances fiscales, primes annuelles et fins de crédit</span>
        </div>
        <div>
          {data.calendar.length === 0 && <div className="empty">Aucune échéance sur 12 mois.</div>}
          {data.calendar.map((m) => (
            <div className="cal-row" key={m.ym}>
              <span className="cal-m">{monthLabel(m.ym)}</span>
              <div className="cal-items">
                {m.items.map((it, i) => <span className="cal-chip" key={i}>{it.label}{it.value ? <> <b className="num private">{eur(it.value)}</b></> : null}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
