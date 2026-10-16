import { db } from "@/lib/db"
import { investmentFlows } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { randomUUID } from "crypto"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

// Un versement par mois : saisir un mois déjà présent le remplace.
export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const b = (await req.json()) as { ym?: string; amountCents?: number; matchCents?: number; note?: string }
  if (!b.ym || !/^\d{4}-\d{2}$/.test(b.ym) || !Number.isFinite(b.amountCents)) return err("Mois et montant requis")
  db.delete(investmentFlows).where(and(eq(investmentFlows.householdId, householdId), eq(investmentFlows.ym, b.ym))).run()
  const id = randomUUID()
  db.insert(investmentFlows).values({
    id, householdId, ym: b.ym, amountCents: Math.round(b.amountCents!), matchCents: Math.round(b.matchCents ?? 0), note: (b.note ?? "").trim(),
  }).run()
  return ok({ id }, 201)
}
