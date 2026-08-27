import { db } from "@/lib/db"
import { alerts } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const url = new URL(req.url)
  const kindParam = url.searchParams.get("kind")
  const resolvedParam = url.searchParams.get("resolved")

  const conditions = [eq(alerts.householdId, householdId)]

  if (kindParam) conditions.push(eq(alerts.kind, kindParam))
  if (resolvedParam !== null) {
    conditions.push(eq(alerts.resolved, resolvedParam === "true"))
  }

  const rows = db
    .select()
    .from(alerts)
    .where(and(...conditions))
    .orderBy(desc(alerts.date))
    .all()

  return ok(rows)
}
