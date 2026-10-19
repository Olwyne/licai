import { db } from "@/lib/db"
import { accounts, budgets, households, members, recurring, transactions } from "@/db/schema"
import { count, eq, gt, and } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"
import { resolveAi } from "@/lib/server/ai-key"
import type { OnboardingCounts } from "@/lib/finance/onboarding"

const n = (r: { c: number } | undefined) => r?.c ?? 0

// GET : état des premiers pas du foyer (nombre de comptes, opérations, budgets…).
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const of = (t: typeof accounts | typeof transactions | typeof budgets | typeof members | typeof recurring) =>
    n(db.select({ c: count() }).from(t).where(eq(t.householdId, householdId)).get())
  const counts: OnboardingCounts = {
    accounts: of(accounts), transactions: of(transactions), budgets: of(budgets), members: of(members), recurring: of(recurring),
    incomeSet: n(db.select({ c: count() }).from(members).where(and(eq(members.householdId, householdId), gt(members.monthlyIncomeCents, 0))).get()) > 0,
    aiKey: resolveAi(householdId).key !== null,
  }
  const hh = db.select({ name: households.name }).from(households).where(eq(households.id, householdId)).get()
  return ok({ counts, household: hh?.name ?? "" })
}
