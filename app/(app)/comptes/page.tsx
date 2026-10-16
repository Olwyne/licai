import { db } from "@/lib/db"
import { fxRate } from "@/lib/finance/fx"
import { accounts, members, banks, households, goals, transactions } from "@/db/schema"
import { eq, and, gte } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AccountsClient } from "@/components/features/accounts/AccountsClient"
import type { EnrichedAccount } from "@/components/features/accounts/types"
import type { Goal } from "@/db/schema"
import { buildFinanceContext } from "@/lib/server/finance-context"
import { computePortfolio } from "@/lib/finance/invest"

export default async function ComptesPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId

  const household = db
    .select()
    .from(households)
    .where(eq(households.id, hid))
    .get()

  const memberRows = db
    .select()
    .from(members)
    .where(eq(members.householdId, hid))
    .all()

  const bankRows = db
    .select()
    .from(banks)
    .where(eq(banks.householdId, hid))
    .all()

  const accountRows = db
    .select()
    .from(accounts)
    .where(eq(accounts.householdId, hid))
    .all()

  const memberMap = new Map(memberRows.map((m) => [m.id, m]))

  const fctx = buildFinanceContext(hid)
  const enrichedAccounts: EnrichedAccount[] = accountRows.map((a) => {
    const ownerIds: string[] = JSON.parse(a.ownerIds)
    const ownerNames = ownerIds.map((id) => memberMap.get(id)?.name ?? id)
    return { ...a, ownerIds, ownerNames, balanceBaseCents: Math.round(a.balanceCents * fxRate(a.currency, fctx.fx)) }
  })

  // Goals grouped by memberId for child members
  const goalRows = db
    .select()
    .from(goals)
    .where(eq(goals.householdId, hid))
    .all()

  const childGoals: Record<string, Goal[]> = {}
  for (const g of goalRows) {
    if (g.memberId) {
      if (!childGoals[g.memberId]) childGoals[g.memberId] = []
      childGoals[g.memberId].push(g)
    }
  }

  // Current month spending for child-only accounts
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

  const childMembers = memberRows.filter((m) => m.isChild)
  const childAccountIds = accountRows
    .filter((a) => {
      const ownerIds: string[] = JSON.parse(a.ownerIds)
      return ownerIds.length > 0 && ownerIds.every((id) => memberMap.get(id)?.isChild)
    })
    .map((a) => a.id)

  const childTxRows = childAccountIds.length > 0
    ? db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.householdId, hid),
          gte(transactions.date, monthStart)
        ))
        .all()
        .filter((t) => t.accountId && childAccountIds.includes(t.accountId))
    : []

  // Map spending to child member by account ownerIds
  const childSpending: Record<string, { totalCents: number; transactions: { id: string; name: string; amountCents: number; date: string }[] }> = {}
  for (const child of childMembers) {
    const childAcctIds = accountRows
      .filter((a) => {
        const ownerIds: string[] = JSON.parse(a.ownerIds)
        return ownerIds.includes(child.id)
      })
      .map((a) => a.id)

    const childTxs = childTxRows.filter((t) => t.accountId && childAcctIds.includes(t.accountId) && t.amountCents < 0)
    childSpending[child.id] = {
      totalCents: childTxs.reduce((sum, t) => sum + t.amountCents, 0),
      transactions: childTxs.slice(0, 5).map((t) => ({ id: t.id, name: t.name, amountCents: t.amountCents, date: t.date })),
    }
  }

  const portfolio = computePortfolio(fctx, "equilibre")
  const fx = {
    rates: fctx.fx, source: fctx.fxSource, ts: fctx.fxTs,
    positions: portfolio.pos.map((p) => ({ value: p.value, qty: p.qty, price: p.price, cur: p.cur })),
  }

  const householdName = household?.name ?? session.user.name ?? "Foyer"

  return (
    <AccountsClient
      household={{ name: householdName, householdId: hid }}
      members={memberRows}
      banks={bankRows}
      accounts={enrichedAccounts}
      childGoals={childGoals}
      childSpending={childSpending}
      fx={fx}
    />
  )
}
