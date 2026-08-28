import { db } from "@/lib/db"
import { properties } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const body = (await req.json()) as {
      name: string
      kind: string
      valueCents: number
      purchasePriceCents: number
      purchaseDate?: string
      note?: string
    }

    if (!body.name?.trim() || !body.kind) {
      return err("Nom et type sont requis.", 400)
    }

    const id = randomUUID()
    const now = new Date()

    db.insert(properties).values({
      id,
      householdId,
      name: body.name.trim(),
      kind: body.kind,
      valueCents: body.valueCents ?? 0,
      purchasePriceCents: body.purchasePriceCents ?? 0,
      purchaseDate: body.purchaseDate ?? null,
      note: body.note ?? "",
      createdAt: now,
    }).run()

    const row = db.select().from(properties).where(eq(properties.id, id)).get()
    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
