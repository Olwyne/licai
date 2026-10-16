import { getHouseholdId, ok, unauthorized } from "@/lib/api"
import { purgeHousehold } from "@/lib/server/household-purge"

// Remise à zéro : supprime toutes les données du foyer, conserve le foyer et les comptes utilisateurs.
export async function DELETE() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  purgeHousehold(householdId, { keepAccount: true })
  return ok({ deleted: true })
}
