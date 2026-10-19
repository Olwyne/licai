type Frequency = "monthly" | "quarterly" | "annual"

export function nextDueDate(lastDate: string, frequency: Frequency): string {
  const [y, m, d] = lastDate.split("-").map(Number)
  const months = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12
  let newMonth = m - 1 + months
  const newYear = y + Math.floor(newMonth / 12)
  newMonth = newMonth % 12
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${newYear}-${pad(newMonth + 1)}-${pad(d)}`
}

export function isOverdue(
  nextDate: string,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  return nextDate < today
}

export function frequencyToMonthlyCents(amountCents: number, frequency: Frequency): number {
  const divisor = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12
  return Math.round(amountCents / divisor)
}
