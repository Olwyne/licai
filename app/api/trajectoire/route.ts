import { db } from "@/lib/db"
import { members, accounts, recurring } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export type MemberProjection = {
  memberId: string
  name: string
  short: string
  colorHex: string
  birthYear: number
  retireYear: number
  yearsToRetirement: number
  currentSavingsCents: number
  monthlySavingsCents: number
  projectedFVCents: number
  monthlyRetirementIncomeCents: number
  yearByYear: Array<{ year: number; valueCents: number }>
}

export type TrajectoireData = {
  members: MemberProjection[]
  kpi: {
    totalCurrentSavingsCents: number
    totalProjectedFVCents: number
    avgRetirementIncomeCents: number
  }
}

function computeFV(
  currentSavingsCents: number,
  monthlySavingsCents: number,
  yearsToRetirement: number
): number {
  const r = 0.04
  const n = yearsToRetirement
  if (n <= 0) return currentSavingsCents
  const growth = Math.pow(1 + r, n)
  const fv = currentSavingsCents * growth + monthlySavingsCents * 12 * ((growth - 1) / r)
  return Math.round(fv)
}

export async function GET() {
  try {
    const householdId = await getHouseholdId()
    if (!householdId) return unauthorized()

    const currentYear = new Date().getFullYear()

    // All members
    const allMembers = db
      .select()
      .from(members)
      .where(eq(members.householdId, householdId))
      .all()

    // All savings accounts (balance)
    const savingsAccounts = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, householdId), eq(accounts.type, "savings")))
      .all()

    // Active recurring with kind="saving"
    const savingRecurring = db
      .select()
      .from(recurring)
      .where(
        and(
          eq(recurring.householdId, householdId),
          eq(recurring.kind, "saving"),
          eq(recurring.active, true)
        )
      )
      .all()

    // Total monthly saving contributions (across all members — household level)
    const householdMonthlySavings = savingRecurring
      .filter((r) => r.frequency === "monthly")
      .reduce((s, r) => s + Math.abs(r.amountCents), 0)

    // Map ownerIds → sum of savings account balances per member
    // ownerIds is stored as a JSON array string: e.g. '["memberId1"]'
    function parseOwnerIds(raw: string): string[] {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === "string")
        }
        return []
      } catch {
        return []
      }
    }

    const memberSavingsMap: Record<string, number> = {}
    for (const acc of savingsAccounts) {
      const owners = parseOwnerIds(acc.ownerIds)
      if (owners.length === 0) continue
      const share = Math.round(acc.balanceCents / owners.length)
      for (const ownerId of owners) {
        memberSavingsMap[ownerId] = (memberSavingsMap[ownerId] ?? 0) + share
      }
    }

    // Distribute monthly savings evenly among members that have retireYear set
    const eligibleMembers = allMembers.filter(
      (m) => m.retireYear != null && (m.retireYear - currentYear) > 0
    )

    const perMemberMonthlySavings =
      eligibleMembers.length > 0
        ? Math.round(householdMonthlySavings / eligibleMembers.length)
        : 0

    const projections: MemberProjection[] = []

    for (const member of eligibleMembers) {
      const retireYear = member.retireYear!
      const yearsToRetirement = retireYear - currentYear
      const currentSavingsCents = memberSavingsMap[member.id] ?? 0
      const monthlySavingsCents = perMemberMonthlySavings
      const projectedFVCents = computeFV(currentSavingsCents, monthlySavingsCents, yearsToRetirement)
      const monthlyRetirementIncomeCents = Math.round((projectedFVCents * 0.04) / 12)

      // yearByYear: from currentYear to retireYear, max 50 points
      const totalYears = yearsToRetirement + 1 // inclusive
      const MAX_POINTS = 50
      const step = totalYears > MAX_POINTS ? Math.ceil(totalYears / MAX_POINTS) : 1
      const yearByYear: Array<{ year: number; valueCents: number }> = []

      for (let y = currentYear; y <= retireYear; y += step) {
        const n = y - currentYear
        const valueCents = computeFV(currentSavingsCents, monthlySavingsCents, n)
        yearByYear.push({ year: y, valueCents })
      }
      // Always include the final year
      const lastEntry = yearByYear[yearByYear.length - 1]
      if (!lastEntry || lastEntry.year !== retireYear) {
        yearByYear.push({ year: retireYear, valueCents: projectedFVCents })
      }

      projections.push({
        memberId: member.id,
        name: member.name,
        short: member.short,
        colorHex: member.colorHex,
        birthYear: member.birthYear ?? currentYear - 30,
        retireYear,
        yearsToRetirement,
        currentSavingsCents,
        monthlySavingsCents,
        projectedFVCents,
        monthlyRetirementIncomeCents,
        yearByYear,
      })
    }

    const totalCurrentSavingsCents = projections.reduce(
      (s, p) => s + p.currentSavingsCents,
      0
    )
    const totalProjectedFVCents = projections.reduce(
      (s, p) => s + p.projectedFVCents,
      0
    )
    const avgRetirementIncomeCents =
      projections.length > 0
        ? Math.round(
            projections.reduce((s, p) => s + p.monthlyRetirementIncomeCents, 0) /
              projections.length
          )
        : 0

    const data: TrajectoireData = {
      members: projections,
      kpi: {
        totalCurrentSavingsCents,
        totalProjectedFVCents,
        avgRetirementIncomeCents,
      },
    }

    return ok(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur interne"
    return err(message, 500)
  }
}
