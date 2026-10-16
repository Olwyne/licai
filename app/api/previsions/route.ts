import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { buildPrevisions } from "@/lib/server/previsions"

export type { RecurringEvent, MonthForecast, BudgetVsReel, PrevisionData } from "@/lib/server/previsions"

export async function GET(req: Request) {
  try {
    const householdId = await getHouseholdId()
    if (!householdId) return unauthorized()
    const horizonParam = new URL(req.url).searchParams.get("horizon")
    const horizon = [6, 12, 24].includes(Number(horizonParam)) ? Number(horizonParam) : 12
    return ok(buildPrevisions(householdId, horizon))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur interne"
    return err(message, 500)
  }
}
