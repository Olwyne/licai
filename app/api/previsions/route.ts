import { db } from "@/lib/db"
import { recurring, transactions } from "@/db/schema"
import { eq, and, gte } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export type RecurringEvent = {
  name: string
  amountCents: number
  kind: string
}

export type MonthForecast = {
  month: string
  incomeCents: number
  expenseCents: number
  balanceCents: number
  recurringEvents: RecurringEvent[]
}

export type PrevisionData = {
  months: MonthForecast[]
  kpi: {
    avgMonthlyIncomeCents: number
    avgMonthlyExpenseCents: number
    projectedAnnualBalanceCents: number
    totalRecurringMonthlyCents: number
  }
}

export async function GET(req: Request) {
  try {
    const householdId = await getHouseholdId()
    if (!householdId) return unauthorized()

    const url = new URL(req.url)
    const horizonParam = url.searchParams.get("horizon")
    const horizon = [6, 12, 24].includes(Number(horizonParam))
      ? Number(horizonParam)
      : 12

    // Fetch active recurring items
    const activeRecurring = db
      .select()
      .from(recurring)
      .where(and(eq(recurring.householdId, householdId), eq(recurring.active, true)))
      .all()

    // Fetch past 3 months transactions
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const cutoff = threeMonthsAgo.toISOString().slice(0, 10)

    const pastTx = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          gte(transactions.date, cutoff)
        )
      )
      .all()

    // Split past transactions into income (positive) and expense (negative)
    const incomeTx = pastTx.filter((t) => t.amountCents > 0)
    const expenseTx = pastTx.filter((t) => t.amountCents < 0)

    const totalHistIncome = incomeTx.reduce((s, t) => s + t.amountCents, 0)
    const totalHistExpense = expenseTx.reduce((s, t) => s + Math.abs(t.amountCents), 0)

    // Monthly average over 3 months
    const histAvgIncomeCents = Math.round(totalHistIncome / 3)
    const histAvgExpenseCents = Math.round(totalHistExpense / 3)

    // Build month forecasts
    const months: MonthForecast[] = []

    for (let m = 0; m < horizon; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1)
      const year = d.getFullYear()
      const month = d.getMonth() // 0-indexed
      const forecastMonth = `${year}-${String(month + 1).padStart(2, "0")}`

      let recurringIncomeCents = 0
      let recurringExpenseCents = 0
      const events: RecurringEvent[] = []

      for (const item of activeRecurring) {
        const nextD = new Date(item.nextDate)
        let applies = false

        if (item.frequency === "monthly") {
          applies = true
        } else if (item.frequency === "quarterly") {
          const forecastAbs = year * 12 + month
          const nextAbs = nextD.getFullYear() * 12 + nextD.getMonth()
          applies = (forecastAbs - nextAbs) % 3 === 0
        } else if (item.frequency === "annual") {
          applies = month === nextD.getMonth()
        }

        if (applies) {
          if (item.amountCents > 0) {
            recurringIncomeCents += item.amountCents
          } else {
            recurringExpenseCents += Math.abs(item.amountCents)
          }
          events.push({ name: item.name, amountCents: item.amountCents, kind: item.kind })
        }
      }

      const incomeCents = recurringIncomeCents + histAvgIncomeCents
      const expenseCents = recurringExpenseCents + histAvgExpenseCents

      months.push({
        month: forecastMonth,
        incomeCents,
        expenseCents,
        balanceCents: incomeCents - expenseCents,
        recurringEvents: events,
      })
    }

    // KPIs
    const avgMonthlyIncomeCents = Math.round(
      months.reduce((s, m) => s + m.incomeCents, 0) / months.length
    )
    const avgMonthlyExpenseCents = Math.round(
      months.reduce((s, m) => s + m.expenseCents, 0) / months.length
    )
    const projectedAnnualBalanceCents = months
      .slice(0, 12)
      .reduce((s, m) => s + m.balanceCents, 0)

    const totalRecurringMonthlyCents = activeRecurring
      .filter((r) => r.frequency === "monthly")
      .reduce((s, r) => s + Math.abs(r.amountCents), 0)

    const data: PrevisionData = {
      months,
      kpi: {
        avgMonthlyIncomeCents,
        avgMonthlyExpenseCents,
        projectedAnnualBalanceCents,
        totalRecurringMonthlyCents,
      },
    }

    return ok(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur interne"
    return err(message, 500)
  }
}
