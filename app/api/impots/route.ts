import { db } from "@/lib/db"
import { members } from "@/db/schema"
import { eq, gt } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"

// ─── Barème 2024 ─────────────────────────────────────────────────────────────

interface Bracket {
  label: string
  rate: number
  floor: number   // in cents
  ceiling: number | null  // in cents, null = no ceiling
}

const BAREME: Bracket[] = [
  { label: "Tranche 0%",  rate: 0,    floor: 0,         ceiling: 1129400  },
  { label: "Tranche 11%", rate: 0.11, floor: 1129400,   ceiling: 2879700  },
  { label: "Tranche 30%", rate: 0.30, floor: 2879700,   ceiling: 8234100  },
  { label: "Tranche 41%", rate: 0.41, floor: 8234100,   ceiling: 17710600 },
  { label: "Tranche 45%", rate: 0.45, floor: 17710600,  ceiling: null     },
]

// Abattement professionnel 10%, min 495€, max 14171€
const ABATTEMENT_RATE = 0.10
const ABATTEMENT_MIN_CENTS = 49500
const ABATTEMENT_MAX_CENTS = 1417100

function computeAbattement(annualGrossCents: number): number {
  const raw = Math.round(annualGrossCents * ABATTEMENT_RATE)
  return Math.max(ABATTEMENT_MIN_CENTS, Math.min(ABATTEMENT_MAX_CENTS, raw))
}

function applyBareme(quotientCents: number): { totalTaxCents: number; bracketAmounts: number[] } {
  let totalTaxCents = 0
  const bracketAmounts: number[] = []

  for (const bracket of BAREME) {
    if (quotientCents <= bracket.floor) {
      bracketAmounts.push(0)
      continue
    }
    const upper = bracket.ceiling !== null ? Math.min(quotientCents, bracket.ceiling) : quotientCents
    const taxable = upper - bracket.floor
    const tax = Math.round(taxable * bracket.rate)
    bracketAmounts.push(tax)
    totalTaxCents += tax
  }

  return { totalTaxCents, bracketAmounts }
}

// ─── GET /api/impots ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const householdId = await getHouseholdId()
    if (!householdId) return unauthorized()

    const allMembers = db
      .select()
      .from(members)
      .where(eq(members.householdId, householdId))
      .all()

    const earningMembers = allMembers.filter((m) => m.monthlyIncomeCents > 0)

    // Compute per-member data
    const memberData = earningMembers.map((m) => {
      const annualGrossCents = m.monthlyIncomeCents * 12
      const abattementCents = computeAbattement(annualGrossCents)
      const netImposableCents = Math.max(0, annualGrossCents - abattementCents)
      const isChild = m.role.toLowerCase().includes("enfant")
      const partsFiscales = isChild ? 0.5 : 1

      return {
        name: m.name,
        annualGrossCents,
        abattementCents,
        netImposableCents,
        partsFiscales,
      }
    })

    // Count adults for décote threshold
    const adultCount = memberData.filter((m) => m.partsFiscales === 1).length

    const totalNetImposableCents = memberData.reduce((sum, m) => sum + m.netImposableCents, 0)
    const partsFiscales = memberData.reduce((sum, m) => sum + m.partsFiscales, 0)

    const effectiveParts = partsFiscales > 0 ? partsFiscales : 1
    const quotientFamilialCents = Math.round(totalNetImposableCents / effectiveParts)

    const { totalTaxCents, bracketAmounts } = applyBareme(quotientFamilialCents)
    const irBrutCents = Math.round(totalTaxCents * effectiveParts)

    // Décote
    const isCouple = adultCount >= 2
    const decoteThreshold = isCouple ? 319100 : 192900
    let decoteCents = 0
    if (irBrutCents > 0 && irBrutCents <= decoteThreshold) {
      const decoteBase = isCouple ? 144400 : 87300
      decoteCents = Math.max(0, Math.round(decoteBase - 0.4545 * irBrutCents))
    }

    const irNetCents = Math.max(0, irBrutCents - decoteCents)
    const monthlyIrCents = Math.round(irNetCents / 12)
    const tauxEffectif =
      totalNetImposableCents > 0
        ? Math.round((irNetCents / totalNetImposableCents) * 10000) / 100
        : 0

    const brackets = BAREME.map((b, i) => ({
      label: b.label,
      rate: b.rate,
      floor: b.floor,
      ceiling: b.ceiling,
      amountCents: Math.round((bracketAmounts[i] ?? 0) * effectiveParts),
    }))

    return ok({
      members: memberData,
      household: {
        totalNetImposableCents,
        partsFiscales: effectiveParts,
        quotientFamilialCents,
        irBrutCents,
        decoteCents,
        irNetCents,
        monthlyIrCents,
        tauxEffectif,
      },
      brackets,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur interne"
    return err(msg, 500)
  }
}
