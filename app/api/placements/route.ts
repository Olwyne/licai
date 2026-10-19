import { db } from "@/lib/db"
import { investments } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { householdFx } from "@/lib/server/fx-convert"
import { randomUUID } from "crypto"
import type { Investment } from "@/db/schema"

interface InvestmentRow extends Investment {
  currentValueCents: number
  purchaseValueCents: number
  gainCents: number
  gainPct: number
}

interface AllocationItem {
  kind: string
  valueCents: number
  pct: number
}

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const rows = db
      .select()
      .from(investments)
      .where(eq(investments.householdId, householdId))
      .orderBy(desc(investments.createdAt))
      .all()

    const enriched: InvestmentRow[] = rows.map((inv) => {
      const currentValueCents = Math.round(inv.quantity * inv.unitPriceCents)
      const purchaseValueCents = Math.round(inv.quantity * inv.purchasePriceCents)
      const gainCents = currentValueCents - purchaseValueCents
      const gainPct = purchaseValueCents > 0 ? (gainCents / purchaseValueCents) * 100 : 0
      return { ...inv, currentValueCents, purchaseValueCents, gainCents, gainPct }
    })

    const totalValueCents = enriched.reduce((s, r) => s + r.currentValueCents, 0)
    const totalPurchaseCents = enriched.reduce((s, r) => s + r.purchaseValueCents, 0)
    const totalGainCents = totalValueCents - totalPurchaseCents
    const totalGainPct = totalPurchaseCents > 0 ? (totalGainCents / totalPurchaseCents) * 100 : 0

    const byKind: Record<string, number> = {}
    for (const r of enriched) {
      byKind[r.kind] = (byKind[r.kind] ?? 0) + r.currentValueCents
    }
    const allocation: AllocationItem[] = Object.entries(byKind).map(([kind, valueCents]) => ({
      kind,
      valueCents,
      pct: totalValueCents > 0 ? (valueCents / totalValueCents) * 100 : 0,
    }))

    return ok({
      investments: enriched,
      totals: { totalValueCents, totalPurchaseCents, totalGainCents, totalGainPct },
      allocation,
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
      ticker?: string
      kind: string
      quantity: number
      unitPriceCents: number
      purchasePriceCents: number
      note?: string
      accountId?: string | null
      assetClass?: string
      zone?: string
      sector?: string
      currency?: string
      cap?: string
      terPct?: number
      gainCents?: number | null
      prevPriceCents?: number | null
    }

    if (!body.name?.trim()) return err("Le nom est requis.", 400)

    const id = randomUUID()
    const now = new Date()

    db.insert(investments).values({
      id,
      householdId,
      name: body.name.trim(),
      ticker: body.ticker ?? "",
      kind: body.kind,
      quantity: body.quantity,
      unitPriceCents: body.unitPriceCents,
      purchasePriceCents: body.purchasePriceCents,
      note: body.note ?? "",
      createdAt: now,
      accountId: body.accountId ?? null,
      assetClass: body.assetClass ?? "actions",
      zone: body.zone ?? "Monde",
      sector: body.sector ?? "Diversifié",
      currency: body.currency ?? householdFx(householdId).base,
      cap: body.cap ?? "—",
      terPct: body.terPct ?? 0,
      gainCents: body.gainCents ?? null,
      prevPriceCents: body.prevPriceCents ?? null,
    }).run()

    const row = db.select().from(investments).where(and(eq(investments.id, id), eq(investments.householdId, householdId))).get()
    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
