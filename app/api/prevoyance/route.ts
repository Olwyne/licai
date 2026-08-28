import { db } from "@/lib/db"
import { contracts } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const rows = db
      .select()
      .from(contracts)
      .where(eq(contracts.householdId, householdId))
      .orderBy(desc(contracts.createdAt))
      .all()

    const totalValueCents = rows
      .filter((c) => c.kind === "assurance-vie" || c.kind === "retraite")
      .reduce((s, c) => s + c.valueCents, 0)

    const totalMonthlyPremiumCents = rows.reduce((s, c) => s + c.monthlyPremiumCents, 0)

    const byKind: Record<string, number> = {}
    for (const c of rows) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1
    }

    return ok({
      contracts: rows,
      kpis: {
        totalValueCents,
        totalMonthlyPremiumCents,
        count: rows.length,
        byKind,
      },
    })
  } catch {
    return err("Erreur de base de données.", 500)
  }
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const body = (await req.json()) as {
      name: string
      insurer?: string
      kind: string
      valueCents?: number
      monthlyPremiumCents?: number
      startDate?: string
      endDate?: string
      note?: string
    }

    if (!body.name?.trim()) return err("Le nom est requis.", 400)

    const id = randomUUID()
    const now = new Date()

    db.insert(contracts).values({
      id,
      householdId,
      name: body.name.trim(),
      insurer: body.insurer ?? "",
      kind: body.kind,
      valueCents: body.valueCents ?? 0,
      monthlyPremiumCents: body.monthlyPremiumCents ?? 0,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      note: body.note ?? "",
      createdAt: now,
    }).run()

    const row = db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.householdId, householdId)))
      .get()

    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
