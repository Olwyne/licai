import { db } from "@/lib/db"
import { baseBalanceCents, householdFx } from "@/lib/server/fx-convert"
import { members, accounts, recurring, properties, loans, goals, goalPockets, investments } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { frequencyToMonthlyCents } from "@/lib/finance/recurring"

// ─── Probability helper ───────────────────────────────────────────────────────

function normCdf(z: number): number {
  if (z < -6) return 0
  if (z > 6) return 1
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937
  const a4 = -1.821255978, a5 = 1.330274429
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t
  const p = 1 - Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * poly
  return z >= 0 ? p : 1 - p
}

function goalProbabilityPct(
  currentCents: number,
  monthlyEffortCents: number,
  monthsToDeadline: number,
  targetCents: number
): number {
  if (currentCents >= targetCents) return 100
  if (monthsToDeadline <= 0) return currentCents >= targetCents ? 100 : 0
  const years = monthsToDeadline / 12
  const r = 0.05
  const sigma = 0.15
  const growth = Math.pow(1 + r, years)
  const rAnn = r > 0 ? r : 0.001
  const projected = currentCents * growth + monthlyEffortCents * 12 * (growth - 1) / rAnn
  if (years < 2) return projected >= targetCents ? 95 : 0
  if (projected <= 0) return 0
  const z = Math.log(projected / targetCents) / (sigma * Math.sqrt(years))
  return Math.max(0, Math.min(100, Math.round(normCdf(z) * 100)))
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalProjection = {
  id: string
  name: string
  emoji: string
  deadline: string | null
  targetCents: number
  currentCents: number
  pocketCount: number
  monthlyEffortCents: number
  projectedCents: number
  probabilityPct: number
}

export type ChartPoint = {
  date: string
  patrimoineNetCents: number
  isProjection: boolean
}

export type ProjectionRow = {
  year: number
  financierCents: number
  immobilierCents: number
  dettesCents: number
  patrimoineNetCents: number
}

export type TrajectoireData = {
  // Composition
  liquiditesCents: number
  placementsCents: number
  immobilierCents: number
  dettesCents: number
  patrimoineNetCents: number
  // Deltas sur 24 mois (estimated)
  delta24LiquiditesCents: number
  delta24PlacementsCents: number
  delta24ImmobilierCents: number
  delta24DettesCents: number
  // Savings & income
  epargneMenusuelleCents: number
  totalMonthlyIncomeCents: number
  // IF simulator base
  capitalFinancierCents: number
  annualExpensesCents: number
  // Goals
  goals: GoalProjection[]
  totalMonthlyGoalEffortCents: number
  // Chart (historical 24m + projection 30y quarterly)
  chartPoints: ChartPoint[]
  // Projection table
  projections: ProjectionRow[]
}

const R_FINANCIER = 0.05
const R_IMMO = 0.024

function fvCents(
  principalCents: number,
  monthlyCents: number,
  years: number,
  r: number
): number {
  if (years <= 0) return principalCents
  const growth = Math.pow(1 + r, years)
  return Math.round(principalCents * growth + monthlyCents * 12 * (growth - 1) / r)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const householdId = await getHouseholdId()
    if (!householdId) return unauthorized()

    const allAccounts = db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
    const allProperties = db.select().from(properties).where(eq(properties.householdId, householdId)).all()
    const allLoans = db.select().from(loans).where(eq(loans.householdId, householdId)).all()
    const allInvestments = db.select().from(investments).where(eq(investments.householdId, householdId)).all()
    const allRecurring = db.select().from(recurring)
      .where(and(eq(recurring.householdId, householdId), eq(recurring.active, true)))
      .all()
    const allMembers = db.select().from(members).where(eq(members.householdId, householdId)).all()
    const goalRows = db.select().from(goals).where(eq(goals.householdId, householdId)).all()
    const goalIds = goalRows.map(g => g.id)
    const pocketRows = goalIds.length > 0
      ? db.select().from(goalPockets).where(inArray(goalPockets.goalId, goalIds)).all()
      : []

    // ── Composition ───────────────────────────────────────────────────────────
    const liquiditesCents = allAccounts
      .filter(a => a.type === "checking" || a.type === "other")
      .reduce((s, a) => s + baseBalanceCents(a, householdFx(householdId).fx), 0)

    const investmentStocksCents = allInvestments.reduce((s, i) => s + Math.round(i.quantity * i.unitPriceCents), 0)
    const placementsCents = allAccounts
      .filter(a => a.type === "savings" || a.type === "investment")
      .reduce((s, a) => s + baseBalanceCents(a, householdFx(householdId).fx), 0)
      + investmentStocksCents

    const immobilierCents = allProperties.reduce((s, p) => s + p.valueCents, 0)
    const dettesCents = allLoans.reduce((s, l) => s + l.remainingCents, 0)
    const patrimoineNetCents = liquiditesCents + placementsCents + immobilierCents - dettesCents
    const capitalFinancierCents = liquiditesCents + placementsCents

    // ── Savings & income ──────────────────────────────────────────────────────
    const epargneMenusuelleCents = allRecurring
      .filter(r => r.kind === "saving")
      .reduce((s, r) => s + frequencyToMonthlyCents(Math.abs(r.amountCents), r.frequency as "monthly" | "quarterly" | "annual"), 0)

    const totalMonthlyIncomeCents = allMembers.reduce((s, m) => s + m.monthlyIncomeCents, 0)

    const monthlyExpensesCents = Math.max(0, totalMonthlyIncomeCents - epargneMenusuelleCents)
    const annualExpensesCents = monthlyExpensesCents * 12

    // ── Deltas sur 24 mois (estimated) ───────────────────────────────────────
    const totalMonthlyRepaymentCents = allLoans.reduce((s, l) => s + l.monthlyPaymentCents, 0)
    const delta24DettesCents = Math.min(dettesCents, totalMonthlyRepaymentCents * 24)
    const delta24ImmobilierCents = Math.round(immobilierCents * (Math.pow(1 + R_IMMO, 2) - 1) / Math.pow(1 + R_IMMO, 2))
    const delta24FinancierCents = epargneMenusuelleCents * 24
    const financierTotal = liquiditesCents + placementsCents
    const delta24LiquiditesCents = financierTotal > 0
      ? Math.round(delta24FinancierCents * liquiditesCents / financierTotal)
      : 0
    const delta24PlacementsCents = delta24FinancierCents - delta24LiquiditesCents

    // ── Goals ─────────────────────────────────────────────────────────────────
    const recurringByAccountId: Record<string, number> = {}
    for (const r of allRecurring) {
      if (r.kind === "saving" && r.accountId) {
        recurringByAccountId[r.accountId] = (recurringByAccountId[r.accountId] ?? 0)
          + frequencyToMonthlyCents(Math.abs(r.amountCents), r.frequency as "monthly" | "quarterly" | "annual")
      }
    }

    const today = new Date()
    const projectedGoals: GoalProjection[] = goalRows.map(g => {
      const pockets = pocketRows.filter(p => p.goalId === g.id)
      let monthlyEffortCents = 0
      for (const pocket of pockets) {
        const pocketMonthly = recurringByAccountId[pocket.accountId] ?? 0
        monthlyEffortCents += Math.round(pocketMonthly * pocket.pct / 100)
      }

      let monthsToDeadline = 0
      if (g.deadline) {
        const dl = new Date(g.deadline)
        monthsToDeadline = Math.max(0,
          (dl.getFullYear() - today.getFullYear()) * 12 + dl.getMonth() - today.getMonth()
        )
      }

      const r_monthly = Math.pow(1 + R_FINANCIER, 1 / 12) - 1
      let projectedCents = g.currentCents
      if (monthsToDeadline > 0 && r_monthly > 0) {
        const growth = Math.pow(1 + r_monthly, monthsToDeadline)
        projectedCents = Math.round(g.currentCents * growth + monthlyEffortCents * (growth - 1) / r_monthly)
      } else if (monthsToDeadline > 0) {
        projectedCents = g.currentCents + monthlyEffortCents * monthsToDeadline
      }

      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        deadline: g.deadline ?? null,
        targetCents: g.targetCents,
        currentCents: g.currentCents,
        pocketCount: pockets.length,
        monthlyEffortCents,
        projectedCents,
        probabilityPct: goalProbabilityPct(g.currentCents, monthlyEffortCents, monthsToDeadline, g.targetCents),
      }
    }).sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    })

    const totalMonthlyGoalEffortCents = projectedGoals.reduce((s, g) => s + g.monthlyEffortCents, 0)

    // ── Chart data ────────────────────────────────────────────────────────────
    const nowYear = today.getFullYear()
    const nowMonth = today.getMonth()
    const chartPoints: ChartPoint[] = []

    // Historical: 24 months (estimated backward)
    for (let i = 24; i >= 0; i--) {
      const d = new Date(nowYear, nowMonth - i, 1)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const fin = Math.max(0, capitalFinancierCents - epargneMenusuelleCents * i)
      const immo = immobilierCents > 0 ? Math.round(immobilierCents / Math.pow(1 + R_IMMO, i / 12)) : 0
      const debt = dettesCents + totalMonthlyRepaymentCents * i
      chartPoints.push({ date, patrimoineNetCents: fin + immo - debt, isProjection: false })
    }

    // Projection: quarterly for 30 years
    for (let q = 1; q <= 30 * 4; q++) {
      const months = q * 3
      const d = new Date(nowYear, nowMonth + months, 1)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const years = months / 12
      const fin = fvCents(capitalFinancierCents, epargneMenusuelleCents, years, R_FINANCIER)
      const immo = Math.round(immobilierCents * Math.pow(1 + R_IMMO, years))
      const debt = Math.max(0, dettesCents - totalMonthlyRepaymentCents * months)
      chartPoints.push({ date, patrimoineNetCents: fin + immo - debt, isProjection: true })
    }

    // ── Projection table ──────────────────────────────────────────────────────
    const projections: ProjectionRow[] = [1, 3, 5, 10, 20, 30].map(years => {
      const months = years * 12
      const financierCents = fvCents(capitalFinancierCents, epargneMenusuelleCents, years, R_FINANCIER)
      const immoCents = Math.round(immobilierCents * Math.pow(1 + R_IMMO, years))
      const detteCents = Math.max(0, dettesCents - totalMonthlyRepaymentCents * months)
      return {
        year: nowYear + years,
        financierCents,
        immobilierCents: immoCents,
        dettesCents: detteCents,
        patrimoineNetCents: financierCents + immoCents - detteCents,
      }
    })

    const data: TrajectoireData = {
      liquiditesCents,
      placementsCents,
      immobilierCents,
      dettesCents,
      patrimoineNetCents,
      delta24LiquiditesCents,
      delta24PlacementsCents,
      delta24ImmobilierCents,
      delta24DettesCents,
      epargneMenusuelleCents,
      totalMonthlyIncomeCents,
      capitalFinancierCents,
      annualExpensesCents,
      goals: projectedGoals,
      totalMonthlyGoalEffortCents,
      chartPoints,
      projections,
    }

    return ok(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur interne"
    return err(message, 500)
  }
}
