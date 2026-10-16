import { db } from "@/lib/db"
import { banks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  return ok(db.select().from(banks).where(eq(banks.householdId, householdId)).all())
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { name, colorHex, csvSeparator, csvDecimal, csvDateFormat } = await req.json()
  if (!name?.trim()) return err("name is required")
  const id = randomUUID()
  db.insert(banks).values({
    id,
    householdId,
    name: name.trim(),
    colorHex: colorHex ?? "#888780",
    csvSeparator: csvSeparator ?? ";",
    csvDecimal: csvDecimal ?? ",",
    csvDateFormat: csvDateFormat ?? "DD/MM/YYYY",
  }).run()
  return ok(db.select().from(banks).where(eq(banks.id, id)).get(), 201)
}
