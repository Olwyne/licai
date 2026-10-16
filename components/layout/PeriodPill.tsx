"use client"
import { usePathname } from "next/navigation"

// Pastille « période en cours » de la barre du haut du design (masquée sur certains écrans).
const SHOWN = ["/transactions", "/objectifs", "/recurrent", "/comptes", "/patrimoine", "/credits", "/previsions", "/trajectoire", "/prevoyance", "/alertes"]

export function PeriodPill() {
  const path = usePathname()
  if (!SHOWN.some((p) => path.startsWith(p))) return null
  const label = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return (
    <div className="period-row">
      <span className="pill" title="Période en cours"><i className="ti ti-calendar" /> {label.charAt(0).toUpperCase() + label.slice(1)}</span>
    </div>
  )
}
