import { db } from "@/lib/db"
import { transactions } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { suggestFromHistory } from "@/lib/finance/categorize"
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

  // Lignes sans catégorie : on reprend celle des transactions déjà catégorisées du même commerçant (confiance ≥ 75 %)
  const known = db.select().from(transactions).where(and(eq(transactions.householdId, householdId), eq(transactions.kind, "expense"))).all()
    .filter((t) => t.categoryId).map((t) => ({ id: t.id, name: t.name, categoryId: t.categoryId, amountCents: t.amountCents }))
  const pending = (rows as ImportRow[]).map((r, i) => ({ id: String(i), name: r.name ?? "", categoryId: null, amountCents: r.amountCents })).filter((t, i) => !(rows as ImportRow[])[i].categoryId && (rows as ImportRow[])[i].amountCents < 0)
  const guessed = new Map(suggestFromHistory(pending, known, 0.75).map((s) => [Number(s.id), s.categoryId]))
  let autoCategorized = 0

  for (const [index, row] of (rows as ImportRow[]).entries()) {
    if (!row.name || typeof row.amountCents !== "number" || !row.date) continue

    const id = randomUUID()
    db.insert(transactions)
      .values({
        id,
        householdId,
        accountId,
        categoryId: row.categoryId ?? guessed.get(index) ?? null,
        name: row.name,
        ...toBaseAmount(householdId, accountId, row.amountCents, row.date),
        date: row.date,
        note: row.note ?? "",
        isCommon: ownerIds.length !== 1,
        memberId: ownerIds.length === 1 ? ownerIds[0] : null,
        importedAt: now,
        createdAt: now,
      })
      .run()

    if (!row.categoryId && guessed.has(index)) autoCategorized++
    inserted.push(id)
  }

  revalidateTag("transactions", { expire: 0 })
  return ok({ imported: inserted.length, autoCategorized }, 201)
}
