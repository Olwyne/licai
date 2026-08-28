import { db } from "@/lib/db"
import { members, accounts, transactions } from "@/db/schema"
import { eq, and, like } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

function currentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  try {
    const month = currentMonth()

    const memberRows = db
      .select()
      .from(members)
      .where(eq(members.householdId, householdId))
      .all()

    const accountRows = db
      .select()
      .from(accounts)
      .where(eq(accounts.householdId, householdId))
      .all()

    const txRows = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.householdId, householdId), like(transactions.date, `${month}%`)))
      .all()

    // Parse ownerIds for each account
    const accountOwners = accountRows.map((a) => ({
      id: a.id,
      ownerIds: (() => {
        try {
          return JSON.parse(a.ownerIds) as string[]
        } catch {
          return [] as string[]
        }
      })(),
    }))

    // For each member, find account ids they own
    const memberAccountIds = new Map<string, Set<string>>()
    for (const m of memberRows) {
      const owned = new Set<string>()
      for (const a of accountOwners) {
        if (a.ownerIds.includes(m.id)) owned.add(a.id)
      }
      memberAccountIds.set(m.id, owned)
    }

    // Common expenses total (isCommon=true, amountCents < 0)
    const commonExpensesTotalCents = txRows
      .filter((tx) => tx.isCommon && tx.amountCents < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0)

    const n = memberRows.length || 1
    const sharePerMember = Math.round(commonExpensesTotalCents / n)

    // Per-member stats
    type MemberResult = {
      id: string
      name: string
      short: string
      colorHex: string
      incomeCents: number
      expenseCents: number
      shareOfCommonCents: number
      balanceCents: number
    }

    const memberResults: MemberResult[] = memberRows.map((m) => {
      const ownedAccountIds = memberAccountIds.get(m.id) ?? new Set()
      const memberTx = txRows.filter(
        (tx) => tx.accountId !== null && ownedAccountIds.has(tx.accountId)
      )
      const incomeCents = memberTx
        .filter((tx) => tx.amountCents > 0)
        .reduce((sum, tx) => sum + tx.amountCents, 0)
      const expenseCents = memberTx
        .filter((tx) => tx.amountCents < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0)
      const balanceCents = incomeCents - expenseCents - sharePerMember

      return {
        id: m.id,
        name: m.name,
        short: m.short,
        colorHex: m.colorHex,
        incomeCents,
        expenseCents,
        shareOfCommonCents: sharePerMember,
        balanceCents,
      }
    })

    // Income split
    const totalIncome = memberResults.reduce((s, m) => s + m.incomeCents, 0)
    const incomeSplit = memberResults.map((m) => ({
      memberId: m.id,
      name: m.name,
      pct: totalIncome > 0 ? Math.round((m.incomeCents / totalIncome) * 100) : 0,
      amountCents: m.incomeCents,
    }))

    // Transfer suggestions (greedy pairing)
    type Transfer = {
      fromId: string
      fromName: string
      toId: string
      toName: string
      amountCents: number
    }

    const balances = memberResults.map((m) => ({ id: m.id, name: m.name, balance: m.balanceCents }))
    const transfers: Transfer[] = []

    // Work on mutable copy
    const working = balances.map((b) => ({ ...b }))

    let safetyCounter = 0
    while (safetyCounter < 100) {
      safetyCounter++
      working.sort((a, b) => a.balance - b.balance)
      const debtor = working[0]
      const creditor = working[working.length - 1]
      if (!debtor || !creditor) break
      if (debtor.balance >= -1 || creditor.balance <= 1) break
      if (debtor.id === creditor.id) break

      const amount = Math.min(Math.abs(debtor.balance), creditor.balance)
      if (amount < 1) break

      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amountCents: amount,
      })

      debtor.balance += amount
      creditor.balance -= amount
    }

    return ok({
      month,
      members: memberResults,
      commonExpensesTotalCents,
      transfers,
      incomeSplit,
    })
  } catch (e) {
    console.error("[partage]", e)
    return err("Erreur serveur", 500)
  }
}
