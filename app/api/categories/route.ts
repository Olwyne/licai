import { db } from "@/lib/db"
import { categories } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db.select().from(categories).where(eq(categories.householdId, householdId)).all()
  return ok(rows)
}
