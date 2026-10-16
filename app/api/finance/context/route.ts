import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { buildFinanceContext } from "@/lib/server/finance-context"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    return ok(buildFinanceContext(householdId))
  } catch {
    return err("Erreur de base de données.", 500)
  }
}
