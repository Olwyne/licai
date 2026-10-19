import { db } from "@/lib/db"
import { fxHistory, households } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { pickRate, type FxSnapshot } from "@/lib/finance/fx-history"
import type { FxTable } from "@/lib/finance/fx"

const today = () => new Date().toISOString().slice(0, 10)

/** Enregistre (ou remplace) le relevé de taux du jour. */
export function recordSnapshot(householdId: string, base: string, rates: FxTable, date = today()): void {
  const row = { householdId, date, base, rates: JSON.stringify(rates) }
  db.insert(fxHistory).values(row).onConflictDoUpdate({ target: [fxHistory.householdId, fxHistory.date], set: { base, rates: row.rates } }).run()
}

export function snapshots(householdId: string): FxSnapshot[] {
  return db.select().from(fxHistory).where(eq(fxHistory.householdId, householdId)).all().flatMap((r) => {
    try { return [{ date: r.date, base: r.base, rates: JSON.parse(r.rates) as FxTable }] } catch { return [] }
  })
}

/** Taux à une date donnée (historique, sinon taux courant du foyer). */
export function rateAt(householdId: string, cur: string, date: string, base: string, fallback: number): number {
  return pickRate(snapshots(householdId), cur, date, base, fallback)
}

export function markUpdated(householdId: string): void {
  db.update(households).set({ fxUpdatedAt: new Date().toISOString() }).where(eq(households.id, householdId)).run()
}

export const hasSnapshotToday = (householdId: string): boolean =>
  !!db.select().from(fxHistory).where(and(eq(fxHistory.householdId, householdId), eq(fxHistory.date, today()))).get()
