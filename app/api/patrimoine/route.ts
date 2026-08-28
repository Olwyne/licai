import { db } from "@/lib/db"
import { properties, loans, accounts } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const props = db
      .select()
      .from(properties)
      .where(eq(properties.householdId, householdId))
      .all()

    const loanRows = db
      .select()
      .from(loans)
      .where(eq(loans.householdId, householdId))
      .all()

    const accts = db
      .select()
      .from(accounts)
      .where(eq(accounts.householdId, householdId))
      .all()

    const totalAccountsCents = accts.reduce((s, a) => s + a.balanceCents, 0)
    const actifBrut = props.reduce((s, p) => s + p.valueCents, 0) + totalAccountsCents
    const passif = loanRows.reduce((s, l) => s + l.remainingCents, 0)
    const patrimoineNet = actifBrut - passif
    const plusValue = props.reduce((s, p) => s + (p.valueCents - p.purchasePriceCents), 0)
    const mensualitesTotales = loanRows.reduce((s, l) => s + l.monthlyPaymentCents, 0)

    return ok({
      properties: props,
      loans: loanRows,
      accounts: { totalCents: totalAccountsCents },
      kpis: { actifBrut, passif, patrimoineNet, plusValue, mensualitesTotales },
    })
  } catch {
    return err("Database error", 500)
  }
}
