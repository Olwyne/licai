import { db } from "@/lib/db"
import { goals, goalPockets, transactions } from "@/db/schema"
import { eq, desc, inArray } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const rows = db.select().from(goals).where(eq(goals.householdId, householdId)).orderBy(desc(goals.createdAt)).all()
    const goalIds = rows.map(g => g.id)
    const pockets = goalIds.length > 0
      ? db.select().from(goalPockets).where(inArray(goalPockets.goalId, goalIds)).all()
      : []

    // Compute currentCents from linked transfers
    const linkedTx = goalIds.length > 0
      ? db.select().from(transactions).where(inArray(transactions.goalId, goalIds)).all()
      : []
    const transferredByGoal = new Map<string, number>()
    for (const t of linkedTx) {
      if (t.goalId && t.kind === "transfer") {
        transferredByGoal.set(t.goalId, (transferredByGoal.get(t.goalId) ?? 0) + Math.abs(t.amountCents))
      }
    }

    const data = rows.map(g => ({
      ...g,
      baseCents: g.currentCents,
      currentCents: (transferredByGoal.get(g.id) ?? 0) + g.currentCents,
      pockets: pockets.filter(p => p.goalId === g.id),
    }))
    return ok(data)
  } catch {
    return err("Database error", 500)
  }
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const body = (await req.json()) as {
      name: string
      emoji?: string
      description?: string
      targetCents: number
      deadline?: string | null
      kind?: string
      colorHex?: string
      linkedAccountId?: string | null
      memberId?: string | null
      currentCents?: number
      monthlyCents?: number | null
      risk?: string
      ownerIds?: string[]
      pockets?: { accountId: string; pct: number }[]
    }

    if (!body.name?.trim() || !body.targetCents) return err("Nom et montant cible sont requis.", 400)

    const id = randomUUID()
    db.insert(goals).values({
      id,
      householdId,
      name: body.name.trim(),
      emoji: body.emoji ?? "🎯",
      description: body.description ?? "",
      targetCents: body.targetCents,
      currentCents: body.currentCents ?? 0,
      monthlyCents: body.monthlyCents ?? null,
      risk: body.risk ?? "equilibre",
      ownerIds: JSON.stringify(body.ownerIds ?? []),
      deadline: body.deadline ?? null,
      kind: body.kind ?? "court",
      colorHex: body.colorHex ?? "#1D9E75",
      linkedAccountId: body.linkedAccountId ?? null,
      memberId: body.memberId ?? null,
      createdAt: new Date(),
    }).run()

    if (body.pockets && body.pockets.length > 0) {
      for (const p of body.pockets) {
        db.insert(goalPockets).values({ id: randomUUID(), goalId: id, accountId: p.accountId, pct: p.pct }).run()
      }
    }

    const row = db.select().from(goals).where(eq(goals.id, id)).get()
    const pockets = db.select().from(goalPockets).where(eq(goalPockets.goalId, id)).all()
    return ok({ ...row, pockets }, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
