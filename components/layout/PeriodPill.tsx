"use client"
import { usePathname } from "next/navigation"
import { shiftMonth, usePeriod } from "@/contexts/PeriodContext"

// Pastille de période de la barre du haut : filtre par mois les écrans qui s'y prêtent (transactions ; le budget a sa propre navigation, synchronisée).
const SHOWN = ["/transactions"]

export function PeriodPill() {
  const path = usePathname()
  const { month, touched, setMonth, reset } = usePeriod()
  if (!SHOWN.some((p) => path.startsWith(p))) return null
  const [y, m] = month.split("-").map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
  return (
    <div className="period-row">
      <button type="button" className="pill" onClick={() => setMonth(shiftMonth(month, -1))} title="Mois précédent" aria-label="Mois précédent"><i className="ti ti-chevron-left" /></button>
      <button type="button" className="pill" onClick={reset} title={touched ? "Revenir à la vue par défaut" : "Période en cours"}>
        <i className="ti ti-calendar" /> {label.charAt(0).toUpperCase() + label.slice(1)}
      </button>
      <button type="button" className="pill" onClick={() => setMonth(shiftMonth(month, 1))} title="Mois suivant" aria-label="Mois suivant"><i className="ti ti-chevron-right" /></button>
    </div>
  )
}
