import { db } from "@/lib/db"
import { accounts, members } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
  const memberRows = db.select().from(members).where(eq(members.householdId, householdId)).all()
  const memberMap = new Map(memberRows.map((m) => [m.id, m.name]))
  const enriched = rows.map((a) => {
    const ownerIds: string[] = JSON.parse(a.ownerIds)
    const ownerNames = ownerIds.map((id) => memberMap.get(id) ?? id)
    return { ...a, ownerNames }
  })
  return ok(enriched)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { name, type, bankId, balanceCents, currency, iban, colorHex, ownerIds } = await req.json()
  if (!name || !type) return err("name and type are required")
  const id = randomUUID()
  db.insert(accounts).values({
    id,
    householdId,
    bankId: bankId ?? null,
    name,
    type,
    balanceCents: balanceCents ?? 0,
    currency: currency ?? "EUR",
    iban: iban ?? null,
    colorHex: colorHex ?? null,
    ownerIds: JSON.stringify(ownerIds ?? []),
  }).run()
  return ok(db.select().from(accounts).where(eq(accounts.id, id)).get(), 201)
}
