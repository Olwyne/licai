import { debtRatio } from "@/lib/finance/credit"
import { buildFinanceContext } from "@/lib/server/finance-context"
import { db } from "@/lib/db"
import { loans } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { randomUUID } from "crypto"
import type { Loan } from "@/db/schema"

interface EnrichedLoan extends Loan {
  echeancesRestantes: number
  interetsRestantsCents: number
  pctRembourse: number
}

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const rows = db
      .select()
      .from(loans)
      .where(eq(loans.householdId, householdId))
      .orderBy(desc(loans.createdAt))
      .all()

    const enriched: EnrichedLoan[] = rows.map((loan) => {
      const r = loan.ratePercent / 100 / 12
      let echeancesRestantes = 0
      if (loan.endDate) {
        const end = new Date(loan.endDate)
        const now = new Date()
        const diff = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
        echeancesRestantes = Math.max(0, diff)
      } else if (loan.monthlyPaymentCents > 0) {
        echeancesRestantes = Math.round(loan.remainingCents / loan.monthlyPaymentCents)
      }

      // Remaining interest = total future payments - remaining principal
      const totalFuturePayments = echeancesRestantes * loan.monthlyPaymentCents
      const interetsRestantsCents = Math.max(0, totalFuturePayments - loan.remainingCents)

      const pctRembourse =
        loan.principalCents > 0
          ? Math.round(((loan.principalCents - loan.remainingCents) / loan.principalCents) * 100)
          : 0

      return { ...loan, echeancesRestantes, interetsRestantsCents, pctRembourse }
    })

    const detteTotaleCents = enriched.reduce((s, l) => s + l.remainingCents, 0)
    const mensualitesCents = enriched.reduce((s, l) => s + l.monthlyPaymentCents, 0)
    const totalInteretsCents = enriched.reduce((s, l) => s + l.interetsRestantsCents, 0)

    // Weighted average rate
    const tauxMoyenPondere =
      detteTotaleCents > 0
        ? enriched.reduce((s, l) => s + l.ratePercent * l.remainingCents, 0) / detteTotaleCents
        : 0

    // Même formule que le tableau de bord (méthode HCSF)
    const tauxEndettement = debtRatio(buildFinanceContext(householdId))

    return ok({
      loans: enriched,
      totals: {
        detteTotaleCents,
        mensualitesCents,
        tauxMoyenPondere,
        tauxEndettement,
        totalInteretsCents,
        count: enriched.length,
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
      kind: string
      principalCents: number
      remainingCents: number
      monthlyPaymentCents: number
      ratePercent: number
      endDate?: string
      note?: string
      propertyId?: string | null
      startDate?: string | null
      accountId?: string | null
      ownerIds?: string[]
      insuranceCents?: number
    }

    if (!body.name?.trim()) return err("Le nom est requis.", 400)

    const id = randomUUID()
    db.insert(loans).values({
      id,
      householdId,
      name: body.name.trim(),
      kind: body.kind ?? "immobilier",
      principalCents: body.principalCents ?? 0,
      remainingCents: body.remainingCents ?? 0,
      monthlyPaymentCents: body.monthlyPaymentCents ?? 0,
      ratePercent: body.ratePercent ?? 0,
      endDate: body.endDate ?? null,
      note: body.note ?? "",
      createdAt: new Date(),
      propertyId: body.propertyId ?? null,
      startDate: body.startDate ?? null,
      accountId: body.accountId ?? null,
      ownerIds: JSON.stringify(body.ownerIds ?? []),
      insuranceCents: body.insuranceCents ?? 0,
    }).run()

    const row = db.select().from(loans).where(eq(loans.id, id)).get()
    return ok(row, 201)
  } catch {
    return err("Erreur lors de la création.", 500)
  }
}
