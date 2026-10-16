import { db } from "@/lib/db"
import { categories } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db.select().from(categories).where(eq(categories.householdId, householdId)).all()
  return ok(rows)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const body = (await req.json()) as { label?: string; icon?: string; colorHex?: string }
  const { label, icon, colorHex } = body
  if (!label?.trim() || !icon?.trim() || !colorHex?.trim()) return err("label, icon and colorHex required")
  const id = randomUUID()
  db.insert(categories).values({ id, householdId, label: label.trim(), icon: icon.trim(), colorHex: colorHex.trim(), isSystem: false }).run()
  const row = db.select().from(categories).where(eq(categories.id, id)).get()
  return ok(row, 201)
}
