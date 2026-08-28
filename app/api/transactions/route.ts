import { db } from "@/lib/db"
import { transactions } from "@/db/schema"
import { eq, and, like, desc } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const url = new URL(req.url)
  const month = url.searchParams.get("month")
  const accountId = url.searchParams.get("accountId")
  const categoryId = url.searchParams.get("categoryId")
  const q = url.searchParams.get("q")

  const conditions = [eq(transactions.householdId, householdId)]
  if (month) conditions.push(like(transactions.date, `${month}%`))
  if (accountId) conditions.push(eq(transactions.accountId, accountId))
  if (categoryId) conditions.push(eq(transactions.categoryId, categoryId))
  if (q) conditions.push(like(transactions.name, `%${q}%`))

  const rows = db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .all()

  return ok(rows)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const body = await req.json()
  const { name, amountCents, date, accountId, categoryId, note, isCommon } = body

  if (!name || typeof amountCents !== "number" || !date) {
    return err("name, amountCents, date are required")
  }

  const id = randomUUID()
  const now = new Date()
  try {
    db.insert(transactions)
      .values({
        id,
        householdId,
        accountId: accountId ?? null,
        categoryId: categoryId ?? null,
        name,
        amountCents,
        date,
        note: note ?? "",
        isCommon: isCommon ?? true,
        importedAt: null,
        createdAt: now,
      })
      .run()
  } catch {
    return err("Constraint violation or database error", 400)
  }

  revalidateTag("transactions", { expire: 0 })
  const created = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .get()

  return ok(created, 201)
}
