import { db } from "@/lib/db"
import { properties, propertyOwners } from "@/db/schema"
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
      address?: string
      surfaceSqm?: number | null
      lots?: string
      taxeFonciereCents?: number
      taxeFonciereHistory?: string
      lastEstimatedAt?: string | null
      residenceType?: string
      rentMonthlyCents?: number
      estimateSource?: string
      costs?: Record<string, number>
      owners?: { memberId: string; sharePercent: number }[]
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
      address: body.address ?? "",
      surfaceSqm: body.surfaceSqm ?? null,
      lots: body.lots ?? "[]",
      taxeFonciereCents: body.taxeFonciereCents ?? 0,
      taxeFonciereHistory: body.taxeFonciereHistory ?? "[]",
      lastEstimatedAt: body.lastEstimatedAt ?? null,
      residenceType: body.residenceType ?? "principale",
      rentMonthlyCents: body.rentMonthlyCents ?? 0,
      estimateSource: body.estimateSource ?? "",
      costs: JSON.stringify(body.costs ?? {}),
      createdAt: now,
    }).run()

    if (body.owners?.length) {
      for (const o of body.owners) {
        db.insert(propertyOwners).values({
          id: randomUUID(),
          propertyId: id,
          memberId: o.memberId,
          sharePercent: o.sharePercent,
        }).run()
      }
    }

    const row = db.select().from(properties).where(eq(properties.id, id)).get()
    const owners = db.select().from(propertyOwners).where(eq(propertyOwners.propertyId, id)).all()
    return ok({ ...row, owners }, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
