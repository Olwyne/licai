import { baseSym } from "@/lib/finance/fx"

export function formatCents(cents: number): string {
  const abs = Math.abs(cents) / 100
  const formatted = abs.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const symbol = " " + baseSym()
  // Normalize narrow no-break space (U+202F) used by fr-FR to regular space
  const normalized = formatted.replace(/ /g, " ")
  return cents < 0 ? `−${normalized}${symbol}` : `${normalized}${symbol}`
}

export function parseCents(str: string): number {
  if (!str) return 0
  const normalized = str.replace(/\s/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

export function maskAmount(_str: string): string {
  return "•••• " + baseSym()
}

export function signedFormatCents(cents: number): string {
  const f = formatCents(Math.abs(cents))
  return cents >= 0 ? `+${f}` : `-${f}`
}
