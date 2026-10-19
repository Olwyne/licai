import { rebase, type FxTable } from "./fx"

// Historique des taux de change : conversion à la date de l'opération et écart de change des comptes en devises.

export interface FxSnapshot { date: string; base: string; rates: FxTable }

/**
 * Taux (1 unité de `cur` = X `base`) à la date demandée : relevé le plus récent au plus tard à cette date,
 * à défaut le plus ancien relevé postérieur, à défaut `fallback` (taux courant). Les relevés pris dans une autre
 * devise de référence sont ramenés à `base`.
 */
export function pickRate(snaps: FxSnapshot[], cur: string, date: string, base: string, fallback: number): number {
  if (cur === base) return 1
  const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date))
  const before = [...sorted].reverse().find((s) => s.date <= date)
  const snap = before ?? sorted[0]
  if (!snap) return fallback
  const table = snap.base === base ? snap.rates : rebase(snap.rates, base)
  const r = table[cur]
  return typeof r === "number" && r > 0 && isFinite(r) ? r : fallback
}

export interface FxGain { cents: number; pct: number }

/** Écart de change latent d'un compte en devise : solde natif × (taux actuel − taux à l'ouverture). */
export function fxGain(nativeCents: number, rateNow: number, rateOpen: number | null | undefined): FxGain | null {
  if (!rateOpen || rateOpen <= 0 || !isFinite(rateOpen)) return null
  return { cents: Math.round(nativeCents * (rateNow - rateOpen)), pct: (rateNow / rateOpen - 1) * 100 }
}
