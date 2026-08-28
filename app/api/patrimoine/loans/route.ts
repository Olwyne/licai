import { db } from "@/lib/db"
import { loans } from "@/db/schema"
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
      principalCents: number
      remainingCents: number
      monthlyPaymentCents: number
      ratePercent: number
      endDate?: string
      note?: string
    }

    if (!body.name?.trim() || !body.kind) {
      return err("Nom et type sont requis.", 400)
    }

    const id = randomUUID()
    const now = new Date()

    db.insert(loans).values({
      id,
      householdId,
      name: body.name.trim(),
      kind: body.kind,
      principalCents: body.principalCents ?? 0,
      remainingCents: body.remainingCents ?? 0,
      monthlyPaymentCents: body.monthlyPaymentCents ?? 0,
      ratePercent: body.ratePercent ?? 0,
      endDate: body.endDate ?? null,
      note: body.note ?? "",
      createdAt: now,
    }).run()

    const row = db.select().from(loans).where(eq(loans.id, id)).get()
    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
