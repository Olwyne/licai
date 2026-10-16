import { db } from "@/lib/db"
import { projects } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const rows = db.select().from(projects).where(eq(projects.householdId, householdId)).orderBy(desc(projects.createdAt)).all()
  return ok(rows)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const body = (await req.json()) as {
      name: string
      emoji?: string
      description?: string
      deadline?: string | null
      colorHex?: string
    }

    if (!body.name?.trim()) return err("Nom requis.", 400)

    const id = randomUUID()
    db.insert(projects).values({
      id,
      householdId,
      name: body.name.trim(),
      emoji: body.emoji ?? "📁",
      description: body.description ?? "",
      deadline: body.deadline ?? null,
      colorHex: body.colorHex ?? "#1D9E75",
      createdAt: new Date(),
    }).run()

    const row = db.select().from(projects).where(eq(projects.id, id)).get()
    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
