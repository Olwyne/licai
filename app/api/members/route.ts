import { db } from "@/lib/db"
import { members } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { randomUUID } from "crypto"
import { revalidateTag } from "next/cache"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  return ok(db.select().from(members).where(eq(members.householdId, householdId)).all())
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { name, short, role, colorHex, monthlyIncomeCents, birthYear, retireYear } = await req.json()
  if (!name || !short) return err("name and short are required")
  const id = randomUUID()
  db.insert(members).values({
    id,
    householdId,
    name,
    short,
    role: role ?? "Membre",
    colorHex: colorHex ?? "#888780",
    monthlyIncomeCents: monthlyIncomeCents ?? 0,
    birthYear: birthYear ?? null,
    retireYear: retireYear ?? null,
  }).run()
  revalidateTag("members", { expire: 0 })
  return ok(db.select().from(members).where(eq(members.id, id)).get(), 201)
}
