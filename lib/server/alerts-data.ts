import { db } from "@/lib/db"
import { baseBalanceCents, householdFx } from "@/lib/server/fx-convert"
import { alerts, alertStates, budgets, categories, goals, goalPockets, accounts, recurring, transactions } from "@/db/schema"
import { and, eq, gte, inArray } from "drizzle-orm"
import { buildFinanceContext } from "@/lib/server/finance-context"
import { buildPrevisions } from "@/lib/server/previsions"
import { computeTax, situationFor, taxInputs } from "@/lib/finance/tax"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"
import { detectAnomalies } from "@/lib/finance/anomalies"
import { buildCalendar, deriveAlerts, type CalMonth, type DerivedAlert, type AlertInputs } from "@/lib/finance/alerts-engine"

export type AlertStatus = "open" | "done" | "snooze"
export interface AlertItem extends DerivedAlert { status: AlertStatus; source: "derived" | "stored" }
export interface AlertsPageData { items: AlertItem[]; calendar: CalMonth[]; today: string; tmi: number; perRoom: number }

const TONE: Record<string, DerivedAlert["tone"]> = { danger: "high", warning: "mid", success: "good", info: "info" }
const KIND_HREF: Record<string, string> = { budget: "/budget", echeance: "/recurrent", optim: "/impots", anomalie: "/transactions" }

export function buildAlertsData(householdId: string): AlertsPageData {
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const ctx = buildFinanceContext(householdId)
  const tax = computeTax(taxInputs(ctx), situationFor(ctx))

  const cats = new Map(db.select().from(categories).where(eq(categories.householdId, householdId)).all().map((c) => [c.id, c]))
  const bud = db.select().from(budgets).where(and(eq(budgets.householdId, householdId), eq(budgets.month, month))).all()
  const since = new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1).toISOString().slice(0, 10)
  const tx = db.select().from(transactions).where(and(eq(transactions.householdId, householdId), gte(transactions.date, since))).all()
    .filter((t) => t.kind === "expense" && t.amountCents < 0)
  const spentIn = (catId: string, from: string, to: string) =>
    tx.filter((t) => t.categoryId === catId && t.date >= from && t.date < to).reduce((s, t) => s + Math.abs(t.amountCents), 0) / 100
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10)
  const budgetsOver = bud.map((b) => {
    const spent = spentIn(b.categoryId, `${month}-01`, nextMonth)
    const hist = tx.filter((t) => t.categoryId === b.categoryId && t.date < `${month}-01`).reduce((s, t) => s + Math.abs(t.amountCents), 0) / 100 / 3
    const c = cats.get(b.categoryId)
    return { id: b.categoryId, label: c?.label ?? "Autre", icon: c?.icon ?? "ti-tag", spent, limit: b.limitCents / 100, avg3: hist }
  }).filter((b) => b.limit > 0 && b.spent > b.limit)

  const rec = db.select().from(recurring).where(eq(recurring.householdId, householdId)).all().map((r) => ({
    id: r.id, name: r.name, amount: Math.abs(r.amountCents) / 100, monthly: Math.abs(frequencyToMonthlyCents(r.amountCents, r.frequency)) / 100,
    frequency: r.frequency, kind: r.kind, active: r.active, nextDate: r.nextDate,
  }))

  const gl = db.select().from(goals).where(eq(goals.householdId, householdId)).all()
  const pk = gl.length ? db.select().from(goalPockets).where(inArray(goalPockets.goalId, gl.map((g) => g.id))).all() : []
  const acc = new Map(db.select().from(accounts).where(eq(accounts.householdId, householdId)).all().map((a) => [a.id, baseBalanceCents(a, householdFx(householdId).fx)]))
  const goalsIn = gl.map((g) => {
    const mine = pk.filter((p) => p.goalId === g.id)
    const current = mine.length ? mine.reduce((s, p) => s + ((acc.get(p.accountId) ?? 0) / 100) * (p.pct / 100), 0) : g.currentCents / 100
    return { id: g.id, name: g.name, current, target: g.targetCents / 100, deadline: g.deadline, risk: g.risk, monthly: g.monthlyCents != null ? g.monthlyCents / 100 : null }
  })

  let forecast: AlertInputs["forecast"] = null
  try {
    const P = buildPrevisions(householdId, 12)
    const low = P.months.reduce((a, m) => (m.runningBalanceCents < a.runningBalanceCents ? m : a), P.months[0])
    if (low) forecast = { ym: low.month, balance: low.runningBalanceCents / 100, buffer: P.kpi.matelasConseille / 100, extras: low.recurringEvents.map((e) => e.name) }
  } catch { /* prévisions indisponibles */ }

  const inputs: AlertInputs = { today, ctx, tax, budgetsOver, recurring: rec, goals: goalsIn, forecast }
  // anomalies : dépenses des 12 derniers mois (hors virements internes)
  const since12 = new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toISOString().slice(0, 10)
  const txYear = db.select().from(transactions).where(and(eq(transactions.householdId, householdId), gte(transactions.date, since12))).all()
    .filter((t) => t.kind === "expense" && t.amountCents < 0)
    .map((t) => ({ id: t.id, name: t.name, amount: Math.abs(t.amountCents) / 100, date: t.date, categoryId: t.categoryId }))
  const anomalies = detectAnomalies({
    today, txs: txYear,
    recurring: rec.map((r) => ({ id: r.id, name: r.name, amount: r.amount, frequency: r.frequency, kind: r.kind, active: r.active })),
    categories: new Map([...cats].map(([id, c]) => [id, { label: c.label, icon: c.icon }])),
  })
  const scheduled = deriveAlerts(inputs)
  const derived = [...scheduled, ...anomalies]
  const states = new Map(db.select().from(alertStates).where(eq(alertStates.householdId, householdId)).all().map((s) => [s.alertId, s.status as AlertStatus]))

  const items: AlertItem[] = derived.map((a) => ({ ...a, status: states.get(a.id) ?? "open", source: "derived" }))
  for (const s of db.select().from(alerts).where(eq(alerts.householdId, householdId)).all()) {
    const kind = (["budget", "echeance", "optim"].includes(s.kind) ? s.kind : "optim") as DerivedAlert["kind"]
    items.push({ id: `db-${s.id}`, kind, tone: TONE[s.tone] ?? "info", icon: s.tone === "success" ? "ti-check" : s.tone === "info" ? "ti-info-circle" : "ti-alert-triangle",
      due: s.date, title: s.title, text: s.body, href: KIND_HREF[kind], status: s.resolved ? "done" : "open", source: "stored" })
  }
  const rank = { high: 0, mid: 1, good: 2, info: 3 }
  items.sort((a, b) => rank[a.tone] - rank[b.tone] || (a.due ?? "9999").localeCompare(b.due ?? "9999"))

  return { items, calendar: buildCalendar(inputs, scheduled), today, tmi: tax.tmi, perRoom: Math.max(0, tax.plafondPer - tax.perVerse) }
}
