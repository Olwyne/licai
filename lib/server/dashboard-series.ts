import { db } from "@/lib/db"
import { transactions, accounts, households } from "@/db/schema"
import { and, eq, gte, lte } from "drizzle-orm"
import { fxRate, mergeFx } from "@/lib/finance/fx"

// Séries revenus / dépenses / trésorerie par période (dashboard) — montants en centimes.

export type PeriodKey = "j" | "s" | "w" | "m" | "t" | "a" | "c"
export interface Series { labels: string[]; rev: number[]; dep: number[]; solde: number[]; rangeLabel: string }

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12) }
export const addDays = (s: string, n: number): string => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
const dLabel = (s: string) => { const [, m, d] = s.split("-").map(Number); return `${d} ${MONTHS[m - 1]}` }
const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5)
const monthEnd = (y: number, m: number) => iso(new Date(y, m, 0, 12))

interface Bucket { f: string; t: string; l: string }

function buckets(from: string, to: string, step: "day" | "week" | "month"): Bucket[] {
  const out: Bucket[] = []
  if (step === "day") for (let d = from; d <= to; d = addDays(d, 1)) out.push({ f: d, t: d, l: dLabel(d) })
  else if (step === "week") for (let d = from; d <= to; d = addDays(d, 7)) { const e = addDays(d, 6); out.push({ f: d, t: e > to ? to : e, l: "sem. " + dLabel(d) }) }
  else {
    let d = from.slice(0, 8) + "01"
    while (d <= to) {
      const [y, m] = d.split("-").map(Number)
      const e = monthEnd(y, m)
      out.push({ f: d, t: e > to ? to : e, l: MONTHS[m - 1] })
      d = addDays(e, 1)
    }
  }
  return out
}

export function cashNowCents(householdId: string): number {
  let stored: unknown = {}
  const hh = db.select().from(households).where(eq(households.id, householdId)).get()
  try { stored = JSON.parse(hh?.fxRates ?? "{}") } catch { /* taux par défaut */ }
  const fx = mergeFx(stored, hh?.currency ?? "EUR")
  return db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
    .filter((a) => a.type !== "investment")
    .reduce((s, a) => s + Math.round(a.balanceCents * fxRate(a.currency, fx)), 0)
}

function seriesFor(householdId: string, bs: Bucket[], rangeLabel: string): Series {
  if (!bs.length) return { labels: [], rev: [], dep: [], solde: [], rangeLabel }
  const from = bs[0].f, to = bs[bs.length - 1].t
  const tx = db.select().from(transactions)
    .where(and(eq(transactions.householdId, householdId), gte(transactions.date, from), lte(transactions.date, to))).all()
    .filter((t) => t.kind !== "transfer")
  const rev: number[] = [], dep: number[] = [], net: number[] = []
  for (const b of bs) {
    const list = tx.filter((t) => t.date >= b.f && t.date <= b.t)
    const r = list.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0)
    const d = list.filter((t) => t.amountCents < 0).reduce((s, t) => s + Math.abs(t.amountCents), 0)
    rev.push(r); dep.push(d); net.push(r - d)
  }
  const solde: number[] = []
  let v = cashNowCents(householdId)
  for (let i = net.length - 1; i >= 0; i--) { solde[i] = v; v -= net[i] }
  return { labels: bs.map((b) => b.l), rev, dep, solde, rangeLabel }
}

/** `anchor` = dernier jour de la période affichée (aujourd'hui, ou fin du mois analysé). */
export function buildSeries(householdId: string, period: PeriodKey, anchor: string, custom?: { from: string; to: string }): Series {
  const [ay, am] = anchor.split("-").map(Number)
  if (period === "j") return seriesFor(householdId, buckets(anchor, anchor, "day"), dLabel(anchor))
  if (period === "s") return seriesFor(householdId, buckets(addDays(anchor, -6), anchor, "day"), `${dLabel(addDays(anchor, -6))} → ${dLabel(anchor)}`)
  if (period === "w") return seriesFor(householdId, buckets(addDays(anchor, -29), anchor, "week"), "30 j, par semaine")
  if (period === "m") {
    const start = iso(new Date(ay, am - 6, 1, 12))
    return seriesFor(householdId, buckets(start, anchor, "month"), "6 derniers mois")
  }
  if (period === "t") {
    const bs: Bucket[] = []
    for (let i = 3; i >= 0; i--) {
      const endM = new Date(ay, am - 1 - i * 3, 1, 12)
      const startM = new Date(endM.getFullYear(), endM.getMonth() - 2, 1, 12)
      const f = iso(startM)
      const t = i === 0 ? anchor : monthEnd(endM.getFullYear(), endM.getMonth() + 1)
      bs.push({ f, t, l: `${MONTHS[startM.getMonth()]}–${MONTHS[endM.getMonth()]}` })
    }
    return seriesFor(householdId, bs, "4 trimestres glissants")
  }
  if (period === "a") {
    const bs: Bucket[] = []
    for (let y = ay - 2; y <= ay; y++) bs.push({ f: `${y}-01-01`, t: y === ay ? anchor : `${y}-12-31`, l: y === ay ? `${y} (partiel)` : String(y) })
    return seriesFor(householdId, bs, "3 années")
  }
  const from = custom?.from ?? addDays(anchor, -13), to = custom?.to ?? anchor
  const span = diffDays(from, to)
  const step = span <= 13 ? "day" : span <= 45 ? "week" : "month"
  return seriesFor(householdId, buckets(from, to, step), `${dLabel(from)} → ${dLabel(to)}`)
}

/** Solde des 30 derniers jours, jour par jour. */
export function dailySolde(householdId: string, anchor: string): { labels: string[]; values: number[] } {
  const s = seriesFor(householdId, buckets(addDays(anchor, -29), anchor, "day"), "")
  return { labels: s.labels, values: s.solde }
}
