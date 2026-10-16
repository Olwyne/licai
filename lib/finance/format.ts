import { baseSym } from "./fx"

// Formatage dans la devise de référence du foyer (euro par défaut), montants entiers pour les calculs fiscaux / patrimoniaux — mêmes conventions que le prototype.

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

export const eur = (n: number): string => nf0.format(Math.round(Math.abs(n) < 0.5 ? 0 : n)).replace(/[  ]/g, " ") + " " + baseSym()
export const eurS = (n: number): string => (n < 0 ? "− " : "+ ") + eur(Math.abs(n))
export const pc = (n: number, d = 1): string =>
  (isFinite(n) ? n : 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, " ") + " %"
export const pcS = (n: number, d = 1): string => (n >= 0 ? "+" : "−") + pc(Math.abs(n), d)
export const num2 = (n: number): string =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, " ")

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

export type Tone = "high" | "mid" | "good" | "info"
export interface Advice {
  sev: Tone
  icon: string
  title: string
  text: string
  action?: string
  gain?: number
}
