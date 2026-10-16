import { db } from "@/lib/db"
import { recurring } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db
    .select()
    .from(recurring)
    .where(eq(recurring.householdId, householdId))
    .all()
  return ok(rows)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const body = (await req.json()) as {
    name?: string
    amountCents?: number
    frequency?: string
    kind?: string
    nextDate?: string
    accountId?: string
    categoryId?: string
    active?: boolean
    ownerIds?: string[]
  }

  const { name, amountCents, frequency, kind, nextDate, accountId, categoryId, active, ownerIds } = body

  if (
    !name ||
    typeof amountCents !== "number" ||
    !frequency ||
    !kind ||
    !nextDate
  ) {
    return err("name, amountCents, frequency, kind, nextDate are required")
  }

  if (!["monthly", "quarterly", "annual"].includes(frequency)) {
    return err("frequency must be monthly, quarterly, or annual")
  }
  if (!["charge", "subscription", "insurance", "saving"].includes(kind)) {
    return err("kind must be charge, subscription, or saving")
  }

  const id = randomUUID()
  try {
    db.insert(recurring)
      .values({
        id,
        householdId,
        name,
        amountCents,
        frequency: frequency as "monthly" | "quarterly" | "annual",
        kind: kind as "charge" | "subscription" | "insurance" | "saving",
        nextDate,
        accountId: accountId ?? null,
        categoryId: categoryId ?? null,
        active: active ?? true,
        ownerIds: JSON.stringify(ownerIds ?? []),
        createdAt: new Date(),
      })
      .run()
  } catch {
    return err("Constraint violation or database error", 400)
  }

  revalidateTag("recurring", { expire: 0 })
  return ok(db.select().from(recurring).where(eq(recurring.id, id)).get(), 201)
}
