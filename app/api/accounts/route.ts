import { db } from "@/lib/db"
import { accounts, members, banks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { randomUUID } from "crypto"
import { revalidateTag } from "next/cache"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
  const memberRows = db.select().from(members).where(eq(members.householdId, householdId)).all()
  const bankRows = db.select().from(banks).where(eq(banks.householdId, householdId)).all()
  const memberMap = new Map(memberRows.map((m) => [m.id, m.name]))
  const bankMap = new Map(bankRows.map((b) => [b.id, b.name]))
  const enriched = rows.map((a) => {
    const ownerIds: string[] = JSON.parse(a.ownerIds)
    const ownerNames = ownerIds.map((id) => memberMap.get(id) ?? id)
    const bankName = a.bankId ? (bankMap.get(a.bankId) ?? null) : null
    return { ...a, ownerNames, bankName }
  })
  return ok(enriched)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { name, type, bankId, balanceCents, currency, iban, colorHex, ownerIds, last4, purpose } = await req.json()
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
    last4: typeof last4 === "string" ? last4.slice(0, 4) : "",
    purpose: typeof purpose === "string" ? purpose : "",
  }).run()
  revalidateTag("accounts", { expire: 0 })
  return ok(db.select().from(accounts).where(eq(accounts.id, id)).get(), 201)
}
