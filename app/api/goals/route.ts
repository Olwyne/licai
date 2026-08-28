import { db } from "@/lib/db"
import { goals } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const rows = db
    .select()
    .from(goals)
    .where(eq(goals.householdId, householdId))
    .orderBy(desc(goals.createdAt))
    .all()

  return ok(rows)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const body = (await req.json()) as {
      name: string
      emoji: string
      targetCents: number
      deadline?: string | null
      kind: string
      colorHex: string
    }

    if (!body.name?.trim() || !body.targetCents) {
      return err("Nom et montant cible sont requis.", 400)
    }

    const id = randomUUID()
    const now = new Date()

    db.insert(goals).values({
      id,
      householdId,
      name: body.name.trim(),
      emoji: body.emoji ?? "🎯",
      targetCents: body.targetCents,
      currentCents: 0,
      deadline: body.deadline ?? null,
      kind: body.kind ?? "court",
      colorHex: body.colorHex ?? "#1D9E75",
      createdAt: now,
    }).run()

    const row = db.select().from(goals).where(eq(goals.id, id)).get()
    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
