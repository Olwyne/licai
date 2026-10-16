import { db } from "@/lib/db"
import { transactions } from "@/db/schema"
import { toBaseAmount } from "@/lib/server/fx-convert"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"
import { revalidateTag } from "next/cache"

interface ImportRow {
  name: string
  amountCents: number
  date: string
  categoryId?: string
  note?: string
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const body = await req.json()
  const { accountId, rows } = body
  const ownerIds: string[] = Array.isArray(body.ownerIds) ? body.ownerIds.filter((x: unknown) => typeof x === "string") : []

  if (!accountId || !Array.isArray(rows)) {
    return err("accountId and rows are required")
  }

  if (rows.length === 0) {
    return ok({ imported: 0 })
  }

  const now = new Date()
  const inserted: string[] = []

  for (const row of rows as ImportRow[]) {
    if (!row.name || typeof row.amountCents !== "number" || !row.date) continue

    const id = randomUUID()
    db.insert(transactions)
      .values({
        id,
        householdId,
        accountId,
        categoryId: row.categoryId ?? null,
        name: row.name,
        ...toBaseAmount(householdId, accountId, row.amountCents),
        date: row.date,
        note: row.note ?? "",
        isCommon: ownerIds.length !== 1,
        memberId: ownerIds.length === 1 ? ownerIds[0] : null,
        importedAt: now,
        createdAt: now,
      })
      .run()

    inserted.push(id)
  }

  revalidateTag("transactions", { expire: 0 })
  return ok({ imported: inserted.length }, 201)
}
