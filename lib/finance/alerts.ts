export interface AlertInput {
  budgets: { categoryId: string; label: string; spentCents: number; limitCents: number }[]
  recurring: { id: string; name: string; nextDate: string; amountCents: number }[]
  today: string
}

export interface GeneratedAlert {
  kind: string
  title: string
  body: string
  tone: "warning" | "info" | "danger" | "success"
}

export function generateAlerts(input: AlertInput): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = []

  for (const b of input.budgets) {
    if (b.limitCents === 0) continue
    const pct = Math.round((b.spentCents / b.limitCents) * 100)
    if (pct >= 100) {
      alerts.push({
        kind: "budget",
        tone: "danger",
        title: `Budget ${b.label} dépassé`,
        body: `${pct}% du plafond consommé ce mois.`,
      })
    } else if (pct >= 90) {
      alerts.push({
        kind: "budget",
        tone: "warning",
        title: `Budget ${b.label} bientôt atteint`,
        body: `${pct}% du plafond consommé.`,
      })
    }
  }

  const [ty, tm, td] = input.today.split("-").map(Number)
  for (const r of input.recurring) {
    const [ry, rm, rd] = r.nextDate.split("-").map(Number)
    const daysUntil = Math.round(
      (new Date(ry, rm - 1, rd).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000
    )
    if (daysUntil < 0) {
      alerts.push({
        kind: "echeance",
        tone: "danger",
        title: `${r.name} — échéance dépassée`,
        body: `Prévu le ${r.nextDate}, il y a ${Math.abs(daysUntil)} jours.`,
      })
    } else if (daysUntil <= 7) {
      alerts.push({
        kind: "echeance",
        tone: "warning",
        title: `${r.name} dans ${daysUntil} jour${daysUntil !== 1 ? "s" : ""}`,
        body: `Prélèvement de ${(r.amountCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € prévu.`,
      })
    }
  }

  return alerts
}
