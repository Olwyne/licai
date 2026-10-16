import { db } from "@/lib/db"
import { transactions, categories, accounts, budgets, recurring, goals, banks } from "@/db/schema"
import { eq, and, like, desc } from "drizzle-orm"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"
import { buildFinanceContext } from "@/lib/server/finance-context"
import { buildSeries, dailySolde, type Series } from "@/lib/server/dashboard-series"
import type { FinanceContext } from "@/lib/finance/types"

// Données du tableau de bord. Tous les montants sont en euros (nombres), sauf mention contraire.

export interface DashCategory { categoryId: string; label: string; icon: string; colorHex: string; amount: number; prev: number; limit: number }
export interface DashTx { id: string; name: string; amount: number; date: string; categoryLabel: string; categoryIcon: string; categoryColor: string; accountName: string }
export interface DashTop { id: string; name: string; amount: number; date: string; categoryLabel: string; categoryIcon: string; categoryColor: string; pct: number }
export interface DashNext { id: string; name: string; amount: number; frequency: string; day: number; kind: string; accountLabel: string; monthly: number }
export interface DashBudget { categoryId: string; label: string; colorHex: string; limit: number; spent: number }
export interface DashGoal { id: string; name: string; emoji: string; current: number; target: number }
export interface DashSplit { id: string; short: string; color: string; incomePct: number; income: number; share: number }

export interface DashboardData {
  firstName: string
  month: string
  anchor: string
  monthLabel: string
  revenus: number
  depenses: number
  epargne: number
  tauxEpargne: number
  nbExpenseTx: number
  nbAccounts: number
  cash: number
  cashPrevMonthPct: number | null
  salaires: number
  loyers: number
  resteJour: number
  chargesFixes: number
  nbRecurring: number
  tauxEndett: number | null
  mensualites: number
  keys: {
    avgPerDay: number; panier: number; nbExpense: number
    biggest: { name: string; amount: number } | null
    worstDay: { date: string; amount: number } | null
    daysNoSpend: number; span: number
    incomeCashed: number; nbIncome: number
    budgetPct: number; budgetSpent: number; budgetLimit: number
    annualized: number
  }
  categories: DashCategory[]
  monthly: { month: string; rev: number; dep: number; saving: number; rate: number; solde: number; varPct: number | null }[]
  series: Series
  daily: { labels: string[]; values: number[] }
  split: { members: DashSplit[]; commun: number; loans: number; recurring: number }
  budgets: DashBudget[]
  top: DashTop[]
  goals: DashGoal[]
  autoSaving: number
  next: DashNext[]
  dueThisMonth: number
  paused: string[]
  lastTx: DashTx[]
  ctx: FinanceContext
}

const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
const FREQ_LABEL: Record<string, string> = { monthly: "mensuel", quarterly: "trimestriel", annual: "annuel" }
const eurOf = (c: number) => c / 100

export function buildDashboardData(hid: string, sessionName: string | null | undefined): DashboardData {
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)
  const hasCurrent = db.select().from(transactions)
    .where(and(eq(transactions.householdId, hid), like(transactions.date, `${currentMonth}%`))).limit(1).all().length > 0
  const lastTx = !hasCurrent
    ? db.select().from(transactions).where(eq(transactions.householdId, hid)).orderBy(desc(transactions.date)).limit(1).all()[0]
    : null
  const month = lastTx ? lastTx.date.slice(0, 7) : currentMonth
  const [yr, mo] = month.split("-").map(Number)
  const prevMonth = `${mo === 1 ? yr - 1 : yr}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`
  const monthEnd = new Date(yr, mo, 0).getDate()
  const anchor = month === currentMonth ? today : `${month}-${String(monthEnd).padStart(2, "0")}`

  const ctx = buildFinanceContext(hid)
  const catRows = db.select().from(categories).where(eq(categories.householdId, hid)).all()
  const acctRows = db.select().from(accounts).where(eq(accounts.householdId, hid)).all()
  const bankRows = db.select().from(banks).where(eq(banks.householdId, hid)).all()
  const budgetRows = db.select().from(budgets).where(and(eq(budgets.householdId, hid), eq(budgets.month, month))).all()
  const recRows = db.select().from(recurring).where(eq(recurring.householdId, hid)).all()
  const goalRows = db.select().from(goals).where(and(eq(goals.householdId, hid), eq(goals.kind, "court"))).all()
  const catMap = new Map(catRows.map((c) => [c.id, c]))
  const acctMap = new Map(acctRows.map((a) => [a.id, a]))
  const bankMap = new Map(bankRows.map((b) => [b.id, b]))

  const txMonth = db.select().from(transactions).where(and(eq(transactions.householdId, hid), like(transactions.date, `${month}%`))).all()
    .filter((t) => t.kind !== "transfer")
  const txPrev = db.select().from(transactions).where(and(eq(transactions.householdId, hid), like(transactions.date, `${prevMonth}%`))).all()
    .filter((t) => t.kind !== "transfer")
  const expenses = txMonth.filter((t) => t.amountCents < 0)
  const incomes = txMonth.filter((t) => t.amountCents > 0)
  const revenus = eurOf(incomes.reduce((s, t) => s + t.amountCents, 0))
  const depenses = eurOf(Math.abs(expenses.reduce((s, t) => s + t.amountCents, 0)))
  const epargne = revenus - depenses
  const tauxEpargne = revenus > 0 ? (epargne / revenus) * 100 : 0

  const cash = ctx.cash.reduce((s, a) => s + a.balance, 0)
  const salaires = ctx.members.filter((m) => !m.isChild).reduce((s, m) => s + m.incomeMonthly, 0)
  const loyers = ctx.properties.reduce((s, p) => s + p.rentMonthly, 0)
  const mensualites = ctx.loans.reduce((s, l) => s + l.monthly, 0)
  const activeRec = recRows.filter((r) => r.active)
  const monthlyOf = (r: (typeof recRows)[number]) => eurOf(frequencyToMonthlyCents(r.amountCents, r.frequency as "monthly" | "quarterly" | "annual"))
  const chargesFixes = activeRec.filter((r) => r.kind !== "saving").reduce((s, r) => s + Math.abs(monthlyOf(r)), 0)
  const autoSaving = activeRec.filter((r) => r.kind === "saving").reduce((s, r) => s + Math.abs(monthlyOf(r)), 0)
  const baseIncome = salaires + loyers > 0 ? salaires + loyers : revenus
  const tauxEndett = baseIncome > 0 ? (mensualites / baseIncome) * 100 : null
  const resteJour = Math.max(0, baseIncome - mensualites - chargesFixes) / 30

  // Séries
  const series = buildSeries(hid, "m", anchor)
  const daily = dailySolde(hid, anchor)
  const monthly = series.labels.map((label, i) => {
    const rev = eurOf(series.rev[i]), dep = eurOf(series.dep[i]), solde = eurOf(series.solde[i])
    const prev = i ? eurOf(series.solde[i - 1]) : null
    return { month: label, rev, dep, saving: rev - dep, rate: rev > 0 ? ((rev - dep) / rev) * 100 : 0, solde, varPct: prev ? ((solde - prev) / Math.abs(prev)) * 100 : null }
  })
  const prevSolde = series.solde.length > 1 ? eurOf(series.solde[series.solde.length - 2]) : null
  const cashPrevMonthPct = prevSolde ? ((cash - prevSolde) / Math.abs(prevSolde)) * 100 : null

  // Catégories (dépenses du mois, variation vs mois précédent, plafond)
  const spentBy = (list: typeof txMonth) => {
    const m = new Map<string, number>()
    for (const t of list) if (t.amountCents < 0 && t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + Math.abs(t.amountCents))
    return m
  }
  const cur = spentBy(txMonth), prv = spentBy(txPrev)
  const limitBy = new Map(budgetRows.map((b) => [b.categoryId, b.limitCents]))
  const categoriesOut: DashCategory[] = [...cur.entries()].map(([id, c]) => {
    const cat = catMap.get(id)
    return { categoryId: id, label: cat?.label ?? "Autre", icon: cat?.icon ?? "ti-tag", colorHex: cat?.colorHex ?? "#888780", amount: eurOf(c), prev: eurOf(prv.get(id) ?? 0), limit: eurOf(limitBy.get(id) ?? 0) }
  }).sort((a, b) => b.amount - a.amount)

  const budgetsOut: DashBudget[] = budgetRows.map((b) => ({
    categoryId: b.categoryId, label: catMap.get(b.categoryId)?.label ?? "Autre", colorHex: catMap.get(b.categoryId)?.colorHex ?? "#888780",
    limit: eurOf(b.limitCents), spent: eurOf(cur.get(b.categoryId) ?? 0),
  }))
  const budgetLimit = budgetsOut.reduce((s, b) => s + b.limit, 0)
  const budgetSpent = budgetsOut.reduce((s, b) => s + b.spent, 0)

  // Chiffres clés
  const byDay = new Map<string, number>()
  for (const t of expenses) byDay.set(t.date, (byDay.get(t.date) ?? 0) + Math.abs(t.amountCents))
  const dates = txMonth.map((t) => t.date).sort()
  const span = dates.length ? Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 864e5) + 1 : 0
  const worst = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]
  const sortedExp = [...expenses].sort((a, b) => a.amountCents - b.amountCents)
  const daysElapsed = month === currentMonth ? Number(today.slice(8, 10)) : monthEnd

  const toTop = (t: (typeof expenses)[number]): DashTop => {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
    return { id: t.id, name: t.name, amount: eurOf(Math.abs(t.amountCents)), date: t.date, categoryLabel: cat?.label ?? "Autre", categoryIcon: cat?.icon ?? "ti-tag", categoryColor: cat?.colorHex ?? "#888780", pct: depenses > 0 ? (Math.abs(t.amountCents) / 100 / depenses) * 100 : 0 }
  }

  // Répartition du foyer
  const adults = ctx.members.filter((m) => !m.isChild && m.incomeMonthly > 0)
  const commRec = activeRec.filter((r) => r.kind !== "saving").reduce((s, r) => s + Math.abs(monthlyOf(r)), 0)
  const commun = mensualites + commRec
  const split: DashSplit[] = ctx.members.filter((m) => !m.isChild).map((m) => {
    const pct = salaires > 0 ? (m.incomeMonthly / salaires) * 100 : adults.length ? 0 : 0
    return { id: m.id, short: m.short, color: m.color, incomePct: pct, income: m.incomeMonthly, share: (commun * pct) / 100 }
  })

  // Échéances
  const next: DashNext[] = [...activeRec]
    .map((r) => {
      const a = r.accountId ? acctMap.get(r.accountId) : undefined
      const bank = a?.bankId ? bankMap.get(a.bankId) : undefined
      return { id: r.id, name: r.name, amount: Math.abs(eurOf(r.amountCents)), frequency: FREQ_LABEL[r.frequency] ?? r.frequency, day: Number(r.nextDate.slice(8, 10)), kind: r.kind, accountLabel: a ? `${bank ? bank.name + " · " : ""}${a.name}` : "", monthly: Math.abs(monthlyOf(r)) }
    })
    .sort((a, b) => a.day - b.day).slice(0, 7)

  const lastTxOut: DashTx[] = db.select().from(transactions).where(eq(transactions.householdId, hid))
    .orderBy(desc(transactions.date), desc(transactions.createdAt)).limit(8).all().map((t) => {
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
      const acct = t.accountId ? acctMap.get(t.accountId) : undefined
      const bank = acct?.bankId ? bankMap.get(acct.bankId) : undefined
      return { id: t.id, name: t.name, amount: eurOf(t.amountCents), date: t.date, categoryLabel: cat?.label ?? "Autre", categoryIcon: cat?.icon ?? "ti-tag", categoryColor: cat?.colorHex ?? "#888780", accountName: acct ? `${bank ? bank.name + " · " : ""}${acct.name}` : "—" }
    })

  const adminMember = ctx.members.find((m) => !m.isChild)
  const firstName = (sessionName?.trim().split(/\s+/)[0]) || adminMember?.short || ""

  return {
    firstName, month, anchor, monthLabel: `${MONTH_NAMES[mo - 1]} ${yr}`,
    revenus, depenses, epargne, tauxEpargne, nbExpenseTx: expenses.length, nbAccounts: acctRows.length,
    cash, cashPrevMonthPct, salaires, loyers, resteJour, chargesFixes, nbRecurring: activeRec.length, tauxEndett, mensualites,
    keys: {
      avgPerDay: depenses / Math.max(1, daysElapsed), panier: expenses.length ? depenses / expenses.length : 0, nbExpense: expenses.length,
      biggest: sortedExp[0] ? { name: sortedExp[0].name, amount: eurOf(Math.abs(sortedExp[0].amountCents)) } : null,
      worstDay: worst ? { date: worst[0], amount: eurOf(worst[1]) } : null,
      daysNoSpend: Math.max(0, span - byDay.size), span,
      incomeCashed: revenus, nbIncome: incomes.length,
      budgetPct: budgetLimit > 0 ? (budgetSpent / budgetLimit) * 100 : 0, budgetSpent, budgetLimit,
      annualized: depenses * 12,
    },
    categories: categoriesOut, monthly, series, daily,
    split: { members: split, commun, loans: mensualites, recurring: commRec },
    budgets: budgetsOut,
    top: sortedExp.slice(0, 6).map(toTop),
    goals: goalRows.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, current: eurOf(g.currentCents), target: eurOf(g.targetCents) })),
    autoSaving, next, dueThisMonth: activeRec.reduce((s, r) => s + Math.abs(monthlyOf(r)), 0),
    paused: recRows.filter((r) => !r.active).map((r) => r.name),
    lastTx: lastTxOut, ctx,
  }
}
