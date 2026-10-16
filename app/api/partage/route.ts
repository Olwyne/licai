import { db } from "@/lib/db"
import { members, accounts, banks, transactions } from "@/db/schema"
import { eq, and, gte } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

const parse = (s: string): string[] => { try { return JSON.parse(s) as string[] } catch { return [] } }

// Données brutes des 30 derniers jours ; la clé de répartition, les soldes et les virements sont calculés côté client.
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const bankName = new Map(db.select().from(banks).where(eq(banks.householdId, householdId)).all().map((b) => [b.id, b.name]))
    const memberRows = db.select().from(members).where(eq(members.householdId, householdId)).all()
    const accountRows = db.select().from(accounts).where(eq(accounts.householdId, householdId)).all()
    const txRows = db.select().from(transactions)
      .where(and(eq(transactions.householdId, householdId), gte(transactions.date, since))).all()

    return ok({
      members: memberRows.map((m) => ({
        id: m.id, name: m.name, short: m.short, colorHex: m.colorHex, incomeCents: m.monthlyIncomeCents, isChild: m.isChild,
      })),
      accounts: accountRows.map((a) => ({
        id: a.id, name: a.name, bank: bankName.get(a.bankId ?? "") ?? "", purpose: a.purpose ?? "", type: a.type, ownerIds: parse(a.ownerIds),
      })),
      transactions: txRows.map((t) => ({
        amountCents: t.amountCents, accountId: t.accountId, memberId: t.memberId, isCommon: t.isCommon, kind: t.kind,
      })),
    })
  } catch (e) {
    console.error("[partage]", e)
    return err("Erreur serveur", 500)
  }
}
