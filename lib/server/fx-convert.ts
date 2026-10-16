import { db } from "@/lib/db"
import { accounts, households } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { fxRate, mergeFx } from "@/lib/finance/fx"

/**
 * Les opérations sont toujours stockées dans la devise de référence du foyer (les agrégats restent homogènes).
 * Pour un compte en devise étrangère, le montant saisi est converti au taux du jour et le montant d'origine est conservé.
 */
export function toBaseAmount(householdId: string, accountId: string | null | undefined, nativeCents: number): { amountCents: number; originalCents: number | null; originalCurrency: string | null } {
  const same = { amountCents: nativeCents, originalCents: null, originalCurrency: null }
  if (!accountId) return same
  const acc = db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.householdId, householdId))).get()
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  const base = hh?.currency ?? "EUR"
  if (!acc || !acc.currency || acc.currency === base) return same
  let stored: unknown = {}
  try { stored = JSON.parse(hh?.fxRates ?? "{}") } catch { /* taux par défaut */ }
  const rate = fxRate(acc.currency, mergeFx(stored, base))
  return { amountCents: Math.round(nativeCents * rate), originalCents: nativeCents, originalCurrency: acc.currency }
}

/** Taux du foyer (exprimés dans la devise de référence) et devise de référence. */
export function householdFx(householdId: string): { base: string; fx: Record<string, number> } {
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  const base = hh?.currency ?? "EUR"
  let stored: unknown = {}
  try { stored = JSON.parse(hh?.fxRates ?? "{}") } catch { /* taux par défaut */ }
  return { base, fx: mergeFx(stored, base) }
}

/** Solde d'un compte converti dans la devise de référence (centimes). */
export const baseBalanceCents = (a: { balanceCents: number; currency: string | null }, fx: Record<string, number>): number =>
  Math.round((a.balanceCents ?? 0) * fxRate(a.currency || "EUR", fx))
