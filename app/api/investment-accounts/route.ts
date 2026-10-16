import { db } from "@/lib/db"
import { investmentAccounts } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

const KINDS = ["av", "pea", "peapme", "cto", "per", "pee", "crypto", "livret"]

export interface AccountBody {
  kind?: string; name?: string; bank?: string
  ownerIds?: string[]; benefIds?: string[]
  sinceYear?: number; paidCents?: number; monthlyCents?: number; feesPct?: number; matchPct?: number
}

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db.select().from(investmentAccounts).where(eq(investmentAccounts.householdId, householdId)).all()
  return ok(rows)
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const b = (await req.json()) as AccountBody
    if (!b.name?.trim()) return err("Le nom est requis.", 400)
    if (!b.kind || !KINDS.includes(b.kind)) return err("Type d'enveloppe invalide.", 400)
    const id = randomUUID()
    db.insert(investmentAccounts).values({
      id, householdId, kind: b.kind, name: b.name.trim(), bank: b.bank ?? "",
      ownerIds: JSON.stringify(b.ownerIds ?? []), benefIds: JSON.stringify(b.benefIds ?? []),
      sinceYear: b.sinceYear ?? new Date().getFullYear(),
      paidCents: b.paidCents ?? 0, monthlyCents: b.monthlyCents ?? 0,
      feesPct: b.feesPct ?? 0, matchPct: b.matchPct ?? 0, createdAt: new Date(),
    }).run()
    return ok({ id }, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
