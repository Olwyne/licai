export function percentSpent(spentCents: number, limitCents: number): number {
  if (limitCents === 0) return 0
  return Math.round((spentCents / limitCents) * 100)
}

export function isBudgetExceeded(spentCents: number, limitCents: number): boolean {
  return spentCents > limitCents
}

export function budgetTone(spentCents: number, limitCents: number): "success" | "warning" | "danger" {
  const pct = percentSpent(spentCents, limitCents)
  if (pct >= 100) return "danger"
  if (pct >= 80) return "warning"
  return "success"
}
